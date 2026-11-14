/**
 * 사진 예외 목록(하나로 통일). 새 표·칸 없이 기존 AssetUsageLog 에 selectionMode='photo-exception' 으로 남긴다.
 * - 자동 채움·자가 힐·야간 점검이 못 고친 칸만 여기에 쌓인다. 문과장은 이 목록만 본다.
 * - 같은 상품·일차에 나중에 자동 채움(selectionMode='auto')이 성공하면 그 예외는 닫힌 것으로 본다.
 * REGRESSION-FREEZE[photo-exception-list]: 예외 목록 한 곳·닫힘 판정 — manifest
 */
export const PHOTO_EXCEPTION_SELECTION_MODE = 'photo-exception'

export type PhotoExceptionOrigin = 'autofill' | 'heal' | 'nightly'

export type PhotoException = {
  productId: string
  /** 대표 사진 칸은 null */
  day: number | null
  kind: 'day' | 'cover'
  sight: string | null
  query: string | null
  reason: string
  detail: string
  origin: PhotoExceptionOrigin
  at: string
}

export function formatPhotoExceptionLine(e: PhotoException): string {
  const slot = e.kind === 'cover' ? '대표' : `${e.day ?? '?'}일차`
  return `${slot} ${e.sight ?? '-'} [${e.reason}]`
}

/** 관리자 등록대기 화면 한 줄(최대 500자)용 */
export function summarizePhotoExceptions(list: readonly PhotoException[], max = 500): string {
  const lines = list.map(formatPhotoExceptionLine)
  let out = `사진 예외 ${list.length}칸: ${lines.join(' / ')}`
  if (out.length > max) out = `${out.slice(0, max - 1)}…`
  return out
}

export function photoExceptionNote(e: PhotoException): string {
  return JSON.stringify({
    v: 1,
    kind: e.kind,
    sight: e.sight,
    query: e.query,
    reason: e.reason,
    detail: e.detail.slice(0, 400),
    origin: e.origin,
    at: e.at,
  }).slice(0, 900)
}

export function parsePhotoExceptionNote(note: string | null | undefined): Omit<PhotoException, 'productId' | 'day'> | null {
  if (!note) return null
  try {
    const v = JSON.parse(note) as Record<string, unknown>
    if (v.v !== 1) return null
    return {
      kind: v.kind === 'cover' ? 'cover' : 'day',
      sight: typeof v.sight === 'string' ? v.sight : null,
      query: typeof v.query === 'string' ? v.query : null,
      reason: String(v.reason ?? ''),
      detail: String(v.detail ?? ''),
      origin: (['autofill', 'heal', 'nightly'] as const).find((o) => o === v.origin) ?? 'autofill',
      at: String(v.at ?? ''),
    }
  } catch {
    return null
  }
}

type LogLike = { productId: string; day: number; usedAt: Date | string; notes?: string | null }

/** 열린 예외 = 같은 상품·일차에 더 늦은 자동 채움 성공 기록이 없는 것 */
export function openPhotoExceptions<T extends LogLike>(exceptionRows: readonly T[], autoRows: readonly Pick<LogLike, 'productId' | 'day' | 'usedAt'>[]): T[] {
  const lastAuto = new Map<string, number>()
  for (const a of autoRows) {
    const k = `${a.productId}:${a.day}`
    const t = new Date(a.usedAt).getTime()
    if (!lastAuto.has(k) || t > lastAuto.get(k)!) lastAuto.set(k, t)
  }
  return exceptionRows.filter((r) => {
    const t = lastAuto.get(`${r.productId}:${r.day}`)
    return t == null || t < new Date(r.usedAt).getTime()
  })
}

export type PhotoExceptionRecordDeps = {
  record?: (input: {
    assetPath?: string | null
    productId: string
    day: number
    selectionMode: string
    sourceType: string
    actorType: 'admin' | 'system'
    notes?: string | null
  }) => Promise<unknown>
  log?: (line: string) => void
}

/** 구조화 로그 한 줄 + AssetUsageLog 한 줄. 기록 실패는 작업을 멈추지 않는다. */
export async function recordPhotoException(e: PhotoException, deps: PhotoExceptionRecordDeps = {}): Promise<void> {
  const log = deps.log ?? ((l: string) => console.log(l))
  log(
    JSON.stringify({
      kind: 'auto-photo-exception',
      productId: e.productId,
      day: e.day,
      slot: e.kind,
      sight: e.sight,
      reason: e.reason,
      origin: e.origin,
      at: e.at,
    }),
  )
  try {
    const record = deps.record ?? (await import('@/lib/asset-usage-log')).recordAssetUsage
    await record({
      productId: e.productId,
      day: e.kind === 'cover' ? 1 : (e.day ?? 1),
      selectionMode: PHOTO_EXCEPTION_SELECTION_MODE,
      sourceType: e.origin,
      actorType: 'system',
      assetPath: null,
      notes: photoExceptionNote(e),
    })
  } catch (err) {
    log(JSON.stringify({ kind: 'auto-photo-exception-record-failed', productId: e.productId, error: err instanceof Error ? err.name : 'Error' }))
  }
}
