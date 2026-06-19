/**
 * ybtour sweep 가격 수집 후 재확인 일정 — Product.rawMeta (schema 변경 없음).
 *
 * REGRESSION-FREEZE[ybtour-sweep-e2e-recheck]: API→E2E 폴백·7일 재확인 — manifest
 */

function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

export const YBTOUR_HORIZON_RECHECK_DAYS = 7

export const YBTOUR_NEXT_PRICE_RECHECK_YMD_KEY = 'ybtourNextPriceRecheckYmd'
export const YBTOUR_LAST_PRICE_COLLECT_SOURCE_KEY = 'ybtourLastPriceCollectSource'
export const YBTOUR_HORIZON_VERIFIED_AT_KEY = 'ybtourHorizonVerifiedAt'

export type YbtourPriceCollectSource = 'api' | 'e2e'

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

export function parseYbtourNextPriceRecheckYmd(rawMeta: string | null | undefined): string | null {
  const v = parseRawMetaObject(rawMeta)[YBTOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return null
}

export function computeYbtourNextPriceRecheckYmd(todayYmd: string): string {
  return addDaysUtcYmd(todayYmd, YBTOUR_HORIZON_RECHECK_DAYS)
}

export function isYbtourPriceRecheckDue(
  rawMeta: string | null | undefined,
  todayYmd: string,
): boolean {
  const next = parseYbtourNextPriceRecheckYmd(rawMeta)
  if (next == null) return true
  return next <= todayYmd
}

export type YbtourPriceRecheckMetaPatch = {
  nextRecheckYmd: string
  collectSource: YbtourPriceCollectSource
  horizonVerifiedAtIso: string
}

export function mergeYbtourPriceRecheckIntoRawMeta(
  rawMeta: string | null | undefined,
  patch: YbtourPriceRecheckMetaPatch,
): string {
  const base = parseRawMetaObject(rawMeta)
  base[YBTOUR_NEXT_PRICE_RECHECK_YMD_KEY] = patch.nextRecheckYmd
  base[YBTOUR_LAST_PRICE_COLLECT_SOURCE_KEY] = patch.collectSource
  base[YBTOUR_HORIZON_VERIFIED_AT_KEY] = patch.horizonVerifiedAtIso
  return JSON.stringify(base)
}

export function clearYbtourPriceRecheckFromRawMeta(rawMeta: string | null | undefined): string {
  const base = parseRawMetaObject(rawMeta)
  delete base[YBTOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  delete base[YBTOUR_LAST_PRICE_COLLECT_SOURCE_KEY]
  delete base[YBTOUR_HORIZON_VERIFIED_AT_KEY]
  return JSON.stringify(base)
}
