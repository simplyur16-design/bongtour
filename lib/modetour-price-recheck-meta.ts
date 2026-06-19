/**
 * modetour sweep 가격 수집 후 재확인 일정 — Product.rawMeta (schema 변경 없음).
 *
 * REGRESSION-FREEZE[modetour-sweep-e2e-recheck]: API→E2E 폴백·7일 재확인 — manifest
 */
import { addDaysUtcYmd } from '@/lib/product-sales-policy'

export const MODETOUR_HORIZON_RECHECK_DAYS = 7

export const MODETOUR_NEXT_PRICE_RECHECK_YMD_KEY = 'modetourNextPriceRecheckYmd'
export const MODETOUR_LAST_PRICE_COLLECT_SOURCE_KEY = 'modetourLastPriceCollectSource'
export const MODETOUR_HORIZON_VERIFIED_AT_KEY = 'modetourHorizonVerifiedAt'

export type ModetourPriceCollectSource = 'api' | 'e2e'

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

export function parseModetourNextPriceRecheckYmd(rawMeta: string | null | undefined): string | null {
  const v = parseRawMetaObject(rawMeta)[MODETOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return null
}

export function parseModetourLastPriceCollectSource(
  rawMeta: string | null | undefined,
): ModetourPriceCollectSource | null {
  const v = parseRawMetaObject(rawMeta)[MODETOUR_LAST_PRICE_COLLECT_SOURCE_KEY]
  if (v === 'api' || v === 'e2e') return v
  return null
}

/** KST 오늘 기준 다음 재확인일(포함) — 6개월 지평 수집 성공 후 7일 뒤. */
export function computeModetourNextPriceRecheckYmd(todayYmd: string): string {
  return addDaysUtcYmd(todayYmd, MODETOUR_HORIZON_RECHECK_DAYS)
}

/** `modetourNextPriceRecheckYmd` 가 미래면 sweep 대상에서 제외. */
export function isModetourPriceRecheckDue(
  rawMeta: string | null | undefined,
  todayYmd: string,
): boolean {
  const next = parseModetourNextPriceRecheckYmd(rawMeta)
  if (next == null) return true
  return next <= todayYmd
}

export type ModetourPriceRecheckMetaPatch = {
  nextRecheckYmd: string
  collectSource: ModetourPriceCollectSource
  horizonVerifiedAtIso: string
}

export function mergeModetourPriceRecheckIntoRawMeta(
  rawMeta: string | null | undefined,
  patch: ModetourPriceRecheckMetaPatch,
): string {
  const base = parseRawMetaObject(rawMeta)
  base[MODETOUR_NEXT_PRICE_RECHECK_YMD_KEY] = patch.nextRecheckYmd
  base[MODETOUR_LAST_PRICE_COLLECT_SOURCE_KEY] = patch.collectSource
  base[MODETOUR_HORIZON_VERIFIED_AT_KEY] = patch.horizonVerifiedAtIso
  return JSON.stringify(base)
}

export function clearModetourPriceRecheckFromRawMeta(rawMeta: string | null | undefined): string {
  const base = parseRawMetaObject(rawMeta)
  delete base[MODETOUR_NEXT_PRICE_RECHECK_YMD_KEY]
  delete base[MODETOUR_LAST_PRICE_COLLECT_SOURCE_KEY]
  delete base[MODETOUR_HORIZON_VERIFIED_AT_KEY]
  return JSON.stringify(base)
}
