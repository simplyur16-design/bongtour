/**
 * verygoodtour sweep 가격 수집 후 재확인 일정 — Product.rawMeta (schema 변경 없음).
 *
 * REGRESSION-FREEZE[verygoodtour-sweep-e2e-recheck]: HXR→E2E·7일 재확인 — manifest
 */

function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

export const VERYGOODTOUR_HORIZON_RECHECK_DAYS = 7

export const VERYGOODTOUR_NEXT_PRICE_RECHECK_YMD_KEY = 'verygoodtourNextPriceRecheckYmd'
export const VERYGOODTOUR_LAST_PRICE_COLLECT_SOURCE_KEY = 'verygoodtourLastPriceCollectSource'
export const VERYGOODTOUR_HORIZON_VERIFIED_AT_KEY = 'verygoodtourHorizonVerifiedAt'

export type VerygoodtourPriceCollectSource = 'hxr' | 'e2e'

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

export function parseVerygoodtourNextPriceRecheckYmd(rawMeta: string | null | undefined): string | null {
  const v = parseRawMetaObject(rawMeta)[VERYGOODTOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return null
}

export function computeVerygoodtourNextPriceRecheckYmd(todayYmd: string): string {
  return addDaysUtcYmd(todayYmd, VERYGOODTOUR_HORIZON_RECHECK_DAYS)
}

export function isVerygoodtourPriceRecheckDue(
  rawMeta: string | null | undefined,
  todayYmd: string,
): boolean {
  const next = parseVerygoodtourNextPriceRecheckYmd(rawMeta)
  if (next == null) return true
  return next <= todayYmd
}

export type VerygoodtourPriceRecheckMetaPatch = {
  nextRecheckYmd: string
  collectSource: VerygoodtourPriceCollectSource
  horizonVerifiedAtIso: string
}

export function mergeVerygoodtourPriceRecheckIntoRawMeta(
  rawMeta: string | null | undefined,
  patch: VerygoodtourPriceRecheckMetaPatch,
): string {
  const base = parseRawMetaObject(rawMeta)
  base[VERYGOODTOUR_NEXT_PRICE_RECHECK_YMD_KEY] = patch.nextRecheckYmd
  base[VERYGOODTOUR_LAST_PRICE_COLLECT_SOURCE_KEY] = patch.collectSource
  base[VERYGOODTOUR_HORIZON_VERIFIED_AT_KEY] = patch.horizonVerifiedAtIso
  return JSON.stringify(base)
}

export function clearVerygoodtourPriceRecheckFromRawMeta(rawMeta: string | null | undefined): string {
  const base = parseRawMetaObject(rawMeta)
  delete base[VERYGOODTOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  delete base[VERYGOODTOUR_LAST_PRICE_COLLECT_SOURCE_KEY]
  delete base[VERYGOODTOUR_HORIZON_VERIFIED_AT_KEY]
  return JSON.stringify(base)
}
