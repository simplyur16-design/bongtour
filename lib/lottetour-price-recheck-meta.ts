/**
 * lottetour sweep 가격 수집 후 재확인 일정 — Product.rawMeta (schema 변경 없음).
 *
 * REGRESSION-FREEZE[lottetour-sweep-e2e-recheck]: HXR→E2E·7일 재확인 — manifest
 */

function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

export const LOTTETOUR_HORIZON_RECHECK_DAYS = 7

export const LOTTETOUR_NEXT_PRICE_RECHECK_YMD_KEY = 'lottetourNextPriceRecheckYmd'
export const LOTTETOUR_LAST_PRICE_COLLECT_SOURCE_KEY = 'lottetourLastPriceCollectSource'
export const LOTTETOUR_HORIZON_VERIFIED_AT_KEY = 'lottetourHorizonVerifiedAt'

export type LottetourPriceCollectSource = 'hxr' | 'e2e'

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

export function parseLottetourNextPriceRecheckYmd(rawMeta: string | null | undefined): string | null {
  const v = parseRawMetaObject(rawMeta)[LOTTETOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return null
}

export function computeLottetourNextPriceRecheckYmd(todayYmd: string): string {
  return addDaysUtcYmd(todayYmd, LOTTETOUR_HORIZON_RECHECK_DAYS)
}

export function isLottetourPriceRecheckDue(
  rawMeta: string | null | undefined,
  todayYmd: string,
): boolean {
  const next = parseLottetourNextPriceRecheckYmd(rawMeta)
  if (next == null) return true
  return next <= todayYmd
}

export type LottetourPriceRecheckMetaPatch = {
  nextRecheckYmd: string
  collectSource: LottetourPriceCollectSource
  horizonVerifiedAtIso: string
}

export function mergeLottetourPriceRecheckIntoRawMeta(
  rawMeta: string | null | undefined,
  patch: LottetourPriceRecheckMetaPatch,
): string {
  const base = parseRawMetaObject(rawMeta)
  base[LOTTETOUR_NEXT_PRICE_RECHECK_YMD_KEY] = patch.nextRecheckYmd
  base[LOTTETOUR_LAST_PRICE_COLLECT_SOURCE_KEY] = patch.collectSource
  base[LOTTETOUR_HORIZON_VERIFIED_AT_KEY] = patch.horizonVerifiedAtIso
  return JSON.stringify(base)
}

export function clearLottetourPriceRecheckFromRawMeta(rawMeta: string | null | undefined): string {
  const base = parseRawMetaObject(rawMeta)
  delete base[LOTTETOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  delete base[LOTTETOUR_LAST_PRICE_COLLECT_SOURCE_KEY]
  delete base[LOTTETOUR_HORIZON_VERIFIED_AT_KEY]
  return JSON.stringify(base)
}
