/**
 * 교원이지 sweep 가격 수집 후 재확인 일정 — Product.rawMeta (schema 변경 없음).
 *
 * REGRESSION-FREEZE[kyowontour-sweep-e2e-recheck]: 7일 재확인·collectSource — manifest
 */

function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

export const KYOWONTOUR_HORIZON_RECHECK_DAYS = 7

export const KYOWONTOUR_NEXT_PRICE_RECHECK_YMD_KEY = 'kyowontourNextPriceRecheckYmd'
export const KYOWONTOUR_LAST_PRICE_COLLECT_SOURCE_KEY = 'kyowontourLastPriceCollectSource'
export const KYOWONTOUR_HORIZON_VERIFIED_AT_KEY = 'kyowontourHorizonVerifiedAt'

export type KyowontourPriceCollectSource = 'ajax' | 'e2e'

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

export function parseKyowontourNextPriceRecheckYmd(rawMeta: string | null | undefined): string | null {
  const v = parseRawMetaObject(rawMeta)[KYOWONTOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return null
}

export function computeKyowontourNextPriceRecheckYmd(todayYmd: string): string {
  return addDaysUtcYmd(todayYmd, KYOWONTOUR_HORIZON_RECHECK_DAYS)
}

export function isKyowontourPriceRecheckDue(
  rawMeta: string | null | undefined,
  todayYmd: string,
): boolean {
  const next = parseKyowontourNextPriceRecheckYmd(rawMeta)
  if (next == null) return true
  return next <= todayYmd
}

export type KyowontourPriceRecheckMetaPatch = {
  nextRecheckYmd: string
  collectSource: KyowontourPriceCollectSource
  horizonVerifiedAtIso: string
}

export function mergeKyowontourPriceRecheckIntoRawMeta(
  rawMeta: string | null | undefined,
  patch: KyowontourPriceRecheckMetaPatch,
): string {
  const base = parseRawMetaObject(rawMeta)
  base[KYOWONTOUR_NEXT_PRICE_RECHECK_YMD_KEY] = patch.nextRecheckYmd
  base[KYOWONTOUR_LAST_PRICE_COLLECT_SOURCE_KEY] = patch.collectSource
  base[KYOWONTOUR_HORIZON_VERIFIED_AT_KEY] = patch.horizonVerifiedAtIso
  return JSON.stringify(base)
}

export function clearKyowontourPriceRecheckFromRawMeta(rawMeta: string | null | undefined): string {
  const base = parseRawMetaObject(rawMeta)
  delete base[KYOWONTOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  delete base[KYOWONTOUR_LAST_PRICE_COLLECT_SOURCE_KEY]
  delete base[KYOWONTOUR_HORIZON_VERIFIED_AT_KEY]
  return JSON.stringify(base)
}
