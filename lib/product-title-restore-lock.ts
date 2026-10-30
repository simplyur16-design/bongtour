/**
 * REGRESSION-FREEZE[product-title-restore-lock]: 제목 복구 잠금 — 재등록·travel/parse 가 잠긴 상품의 제목을 덮어쓰지 않음 — manifest
 *
 * 사장님 2026-10-30 19:53 「숨긴 43개까지 포함해서 복구해」 — 복구한 상품은 Product.rawMeta(JSON 문자열)의
 * `titleSupplierOriginalLock` 키로 표시한다(스키마 변경 없음). 잠긴 상품은 상태(신규·등록대기·등록)와 무관하게
 * 자동 경로에서 title·originalTitle 을 쓰지 않고, rawMeta 를 새로 쓰더라도 잠금 키를 유지한다.
 * 값 예: { "lockedAt": "2026-10-30T11:20:58.000Z", "source": "supplier_original", "reason": "...", "restoredTitle": "..." }
 */
export const TITLE_SUPPLIER_ORIGINAL_LOCK_KEY = 'titleSupplierOriginalLock'

/** 잠긴 상품에서 자동 경로가 쓰지 않는 필드 */
export const TITLE_RESTORE_LOCKED_FIELDS = ['title', 'originalTitle'] as const

export type TitleSupplierOriginalLock = {
  lockedAt: string
  source: 'supplier_original'
  reason?: string
  restoredTitle?: string
}

function parseRawMetaObject(rawMeta: unknown): Record<string, unknown> | null {
  if (typeof rawMeta !== 'string' || !rawMeta.trim()) return null
  try {
    const v = JSON.parse(rawMeta) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function readTitleSupplierOriginalLock(rawMeta: string | null | undefined): TitleSupplierOriginalLock | null {
  const v = parseRawMetaObject(rawMeta)?.[TITLE_SUPPLIER_ORIGINAL_LOCK_KEY]
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (o.source !== 'supplier_original') return null
  if (typeof o.lockedAt !== 'string' || !o.lockedAt.trim()) return null
  return {
    lockedAt: o.lockedAt,
    source: 'supplier_original',
    reason: typeof o.reason === 'string' ? o.reason : undefined,
    restoredTitle: typeof o.restoredTitle === 'string' ? o.restoredTitle : undefined,
  }
}

export function isTitleSupplierOriginalLocked(rawMeta: string | null | undefined): boolean {
  return readTitleSupplierOriginalLock(rawMeta) != null
}

/**
 * 기존 상품 update 데이터에서 잠긴 제목 필드를 뺀다.
 * - 잠금 없음 → data 그대로(같은 객체).
 * - 잠금 있음 → title·originalTitle 제거, data.rawMeta 가 문자열이면 잠금 키를 다시 넣어 유지.
 */
export function stripLockedTitleFieldsFromProductWrite<T extends Record<string, unknown>>(
  existingRawMeta: string | null | undefined,
  data: T,
): T {
  const lockValue = parseRawMetaObject(existingRawMeta)?.[TITLE_SUPPLIER_ORIGINAL_LOCK_KEY]
  if (!readTitleSupplierOriginalLock(existingRawMeta) || lockValue == null) return data
  const out: Record<string, unknown> = { ...data }
  for (const f of TITLE_RESTORE_LOCKED_FIELDS) delete out[f]
  if (typeof out.rawMeta === 'string') {
    const next = parseRawMetaObject(out.rawMeta) ?? {}
    next[TITLE_SUPPLIER_ORIGINAL_LOCK_KEY] = lockValue
    out.rawMeta = JSON.stringify(next)
  } else if (out.rawMeta === null) {
    out.rawMeta = JSON.stringify({ [TITLE_SUPPLIER_ORIGINAL_LOCK_KEY]: lockValue })
  }
  return out as T
}

type RawMetaReader = {
  product: {
    findUnique(args: { where: { id: string }; select: { rawMeta: true } }): Promise<{ rawMeta: string | null } | null>
  }
}

/** DB(또는 트랜잭션)에서 기존 rawMeta 를 읽어 잠금을 적용 — 재등록 existing 분기·travel/parse update 직전에 호출 */
export async function applyTitleRestoreLockToProductUpdate<T extends Record<string, unknown>>(
  db: RawMetaReader,
  productId: string,
  data: T,
): Promise<T> {
  const row = await db.product.findUnique({ where: { id: productId }, select: { rawMeta: true } })
  return stripLockedTitleFieldsFromProductWrite(row?.rawMeta ?? null, data)
}
