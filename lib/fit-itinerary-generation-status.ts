/**
 * 제미나이 추천일정 생성 결과를 rawMeta(JSON 텍스트) 안에 남긴다 — 스키마 변경 없음.
 * 키: rawMeta.fitItineraryGeneration (자유여행), rawMeta.freeDayItineraryGeneration (패키지 자유일정)
 * 실패 사유가 콘솔에만 남고 사라지던 문제(사장님 11/01 19:01) — 매시간 백필이 다시 시도하고 횟수를 센다.
 * REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 실패 사유 rawMeta 기록 — manifest
 */
export const FIT_ITINERARY_GENERATION_META_KEY = 'fitItineraryGeneration'
export const FREE_DAY_ITINERARY_GENERATION_META_KEY = 'freeDayItineraryGeneration'
/** 같은 상품을 매시간 무한히 부르지 않도록 — 넘으면 백필 대상에서 빼고 사유만 남김 */
export const ITINERARY_GENERATION_MAX_ATTEMPTS = 12

export type ItineraryGenerationStatus = {
  status: 'ok' | 'failed'
  reason: string | null
  detail: string | null
  attempts: number
  at: string
}

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    const v = JSON.parse(raw) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function readItineraryGenerationStatus(
  rawMeta: string | null | undefined,
  key: string = FIT_ITINERARY_GENERATION_META_KEY,
): ItineraryGenerationStatus | null {
  const v = parseMeta(rawMeta)[key]
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  return {
    status: o.status === 'ok' ? 'ok' : 'failed',
    reason: typeof o.reason === 'string' ? o.reason : null,
    detail: typeof o.detail === 'string' ? o.detail : null,
    attempts: Math.max(0, Math.floor(Number(o.attempts) || 0)),
    at: typeof o.at === 'string' ? o.at : '',
  }
}

/** rawMeta 텍스트에 상태를 합친다(다른 키는 그대로). 원문이 JSON 이 아니면 바꾸지 않고 null. */
export function mergeItineraryGenerationStatusIntoRawMeta(
  rawMeta: string | null | undefined,
  next: { ok: boolean; reason?: string | null; detail?: string | null },
  key: string = FIT_ITINERARY_GENERATION_META_KEY,
  now: Date = new Date(),
): string | null {
  if (rawMeta?.trim()) {
    try {
      const v = JSON.parse(rawMeta) as unknown
      if (!v || typeof v !== 'object' || Array.isArray(v)) return null
    } catch {
      return null
    }
  }
  const meta = parseMeta(rawMeta)
  const prev = readItineraryGenerationStatus(rawMeta, key)
  const status: ItineraryGenerationStatus = {
    status: next.ok ? 'ok' : 'failed',
    reason: next.ok ? null : String(next.reason ?? 'unknown').slice(0, 80),
    detail: next.ok ? null : next.detail ? String(next.detail).slice(0, 300) : null,
    attempts: next.ok ? (prev?.attempts ?? 0) + 1 : (prev?.attempts ?? 0) + 1,
    at: now.toISOString(),
  }
  meta[key] = status
  return JSON.stringify(meta)
}

export function itineraryGenerationAttemptsExhausted(
  rawMeta: string | null | undefined,
  key: string = FIT_ITINERARY_GENERATION_META_KEY,
): boolean {
  const s = readItineraryGenerationStatus(rawMeta, key)
  return !!s && s.status === 'failed' && s.attempts >= ITINERARY_GENERATION_MAX_ATTEMPTS
}

/** DB 기록 — 실패해도 호출부를 막지 않는다 */
export async function recordItineraryGenerationStatus(
  productId: string,
  next: { ok: boolean; reason?: string | null; detail?: string | null },
  key: string = FIT_ITINERARY_GENERATION_META_KEY,
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const p = await prisma.product.findUnique({ where: { id: productId }, select: { rawMeta: true } })
    if (!p) return
    const merged = mergeItineraryGenerationStatusIntoRawMeta(p.rawMeta, next, key)
    if (merged == null) return
    await prisma.product.update({ where: { id: productId }, data: { rawMeta: merged } })
  } catch (e) {
    console.error(`[itinerary-generation-status] record failed productId=${productId}`, e)
  }
}
