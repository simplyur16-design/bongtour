/**
 * parse-and-register 핸들러 안에서만 쓰는 모두투어 전용 분기(히어로·달력 샘플).
 * 공용 핸들러는 본 모듈을 호출해 supplier-specific 부분을 한곳으로 모은다.
 */
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { computeKRWQuotation } from '@/lib/price-utils'

export function modetourHeroBodyHaystack(supplierKey: string, bodyText: string): string | undefined {
  return supplierKey === 'modetour' ? bodyText : undefined
}

export function modetourMetaHeroBodyHaystack(effectiveOriginSource: string, bodyText: string): string | undefined {
  return normalizeSupplierOrigin(effectiveOriginSource) === 'modetour' ? bodyText : undefined
}

/** 모두투어: 성인 1인 총액 최저 출발일 샘플. 그 외: 첫 북가능 행. */
export function pickFirstCalendarSampleDate(
  effectiveOriginSource: string,
  bookablePriceRows: ParsedProductPrice[]
): string | null {
  if (bookablePriceRows.length === 0) return null
  if (normalizeSupplierOrigin(effectiveOriginSource) !== 'modetour') {
    return String(bookablePriceRows[0]!.date).slice(0, 10)
  }
  let best = bookablePriceRows[0]!
  let bestTotal = computeKRWQuotation(best, { adult: 1, childBed: 0, childNoBed: 0, infant: 0 }).total
  for (let i = 1; i < bookablePriceRows.length; i++) {
    const row = bookablePriceRows[i]!
    const t = computeKRWQuotation(row, { adult: 1, childBed: 0, childNoBed: 0, infant: 0 }).total
    if (t < bestTotal) {
      best = row
      bestTotal = t
    }
  }
  return String(best.date).slice(0, 10)
}
