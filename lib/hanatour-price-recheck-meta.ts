/**
 * hanatour sweep 가격 수집 후 재확인 일정 — Product.rawMeta (schema 변경 없음).
 *
 * REGRESSION-FREEZE[hanatour-sweep-e2e-recheck]: API→E2E 폴백·7일 재확인 — manifest
 */

function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

export const HANATOUR_HORIZON_RECHECK_DAYS = 7

export const HANATOUR_NEXT_PRICE_RECHECK_YMD_KEY = 'hanatourNextPriceRecheckYmd'
export const HANATOUR_LAST_PRICE_COLLECT_SOURCE_KEY = 'hanatourLastPriceCollectSource'
export const HANATOUR_HORIZON_VERIFIED_AT_KEY = 'hanatourHorizonVerifiedAt'

export type HanatourPriceCollectSource = 'api' | 'e2e'

function parseRawMetaObject(rawMeta: string | null | undefined): Record<string, unknown> {
  if (!rawMeta?.trim()) return {}
  try {
    const parsed = JSON.parse(rawMeta) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function parseHanatourNextPriceRecheckYmd(rawMeta: string | null | undefined): string | null {
  const v = parseRawMetaObject(rawMeta)[HANATOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return null
}

export function computeHanatourNextPriceRecheckYmd(todayYmd: string): string {
  return addDaysUtcYmd(todayYmd, HANATOUR_HORIZON_RECHECK_DAYS)
}

export function isHanatourPriceRecheckDue(
  rawMeta: string | null | undefined,
  todayYmd: string,
): boolean {
  const next = parseHanatourNextPriceRecheckYmd(rawMeta)
  if (next == null) return true
  return next <= todayYmd
}

export type HanatourPriceRecheckMetaPatch = {
  nextRecheckYmd: string
  collectSource: HanatourPriceCollectSource
  horizonVerifiedAtIso: string
}

export function mergeHanatourPriceRecheckIntoRawMeta(
  rawMeta: string | null | undefined,
  patch: HanatourPriceRecheckMetaPatch,
): string {
  const base = parseRawMetaObject(rawMeta)
  base[HANATOUR_NEXT_PRICE_RECHECK_YMD_KEY] = patch.nextRecheckYmd
  base[HANATOUR_LAST_PRICE_COLLECT_SOURCE_KEY] = patch.collectSource
  base[HANATOUR_HORIZON_VERIFIED_AT_KEY] = patch.horizonVerifiedAtIso
  return JSON.stringify(base)
}

export function clearHanatourPriceRecheckFromRawMeta(rawMeta: string | null | undefined): string {
  const base = parseRawMetaObject(rawMeta)
  delete base[HANATOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  delete base[HANATOUR_LAST_PRICE_COLLECT_SOURCE_KEY]
  delete base[HANATOUR_HORIZON_VERIFIED_AT_KEY]
  return JSON.stringify(base)
}
