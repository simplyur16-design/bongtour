/**
 * 스티키 견적 카드 전용 — 저장된 공개 단가(`getPublicPerPaxUnitKrw`)를 읽어
 * 공급사 규칙에 맞게 **표시·견적 합계 줄**에만 반영. 원천/병합 로직은 변경하지 않음.
 */
import { getPublicPerPaxUnitKrw, type PublicProductPriceRow } from '@/lib/price-utils'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

export function getStickyDisplayPerPaxKrw(
  row: PublicProductPriceRow | null,
  slot: 'adult' | 'childBed' | 'childNoBed' | 'infant',
  originSource: string | null | undefined
): number | null {
  if (!row) return null
  const key = normalizeSupplierOrigin(originSource)
  const adultStored = getPublicPerPaxUnitKrw(row, 'adult')

  if (key === 'hanatour' || key === 'verygoodtour' || key === 'ybtour') {
    if (slot === 'adult') return adultStored
    if (slot === 'childBed' || slot === 'childNoBed') return adultStored
    return getPublicPerPaxUnitKrw(row, 'infant')
  }

  if (key === 'modetour') {
    if (slot === 'adult') return adultStored
    if (slot === 'childBed') return adultStored
    if (slot === 'childNoBed') return getPublicPerPaxUnitKrw(row, 'childNoBed')
    return getPublicPerPaxUnitKrw(row, 'infant')
  }

  return getPublicPerPaxUnitKrw(row, slot)
}

/** 스티키 카드「선택 인원 견적 합계」— 표시 단가와 동일한 규칙만 사용 */
export function computeStickyDisplayQuotationTotal(
  row: PublicProductPriceRow,
  pax: { adult: number; childBed: number; childNoBed: number; infant: number },
  originSource: string | null | undefined
): number | null {
  const key = normalizeSupplierOrigin(originSource)

  if (key === 'hanatour' || key === 'verygoodtour' || key === 'ybtour') {
    const uA = getStickyDisplayPerPaxKrw(row, 'adult', originSource)
    let sum = 0
    if (pax.adult > 0) {
      if (uA == null) return null
      sum += uA * pax.adult
    }
    const ch = pax.childBed + pax.childNoBed
    if (ch > 0) {
      if (uA == null) return null
      sum += uA * ch
    }
    if (pax.infant > 0) {
      const uI = getStickyDisplayPerPaxKrw(row, 'infant', originSource)
      if (uI == null) return null
      sum += uI * pax.infant
    }
    return sum
  }

  if (key === 'modetour') {
    let sum = 0
    if (pax.adult > 0) {
      const u = getStickyDisplayPerPaxKrw(row, 'adult', originSource)
      if (u == null) return null
      sum += u * pax.adult
    }
    if (pax.childBed > 0) {
      const u = getStickyDisplayPerPaxKrw(row, 'childBed', originSource)
      if (u == null) return null
      sum += u * pax.childBed
    }
    if (pax.childNoBed > 0) {
      const u = getStickyDisplayPerPaxKrw(row, 'childNoBed', originSource)
      if (u == null) return null
      sum += u * pax.childNoBed
    }
    if (pax.infant > 0) {
      const u = getStickyDisplayPerPaxKrw(row, 'infant', originSource)
      if (u == null) return null
      sum += u * pax.infant
    }
    return sum
  }

  let sum = 0
  if (pax.adult > 0) {
    const u = getStickyDisplayPerPaxKrw(row, 'adult', originSource)
    if (u == null) return null
    sum += u * pax.adult
  }
  if (pax.childBed > 0) {
    const u = getStickyDisplayPerPaxKrw(row, 'childBed', originSource)
    if (u == null) return null
    sum += u * pax.childBed
  }
  if (pax.childNoBed > 0) {
    const u = getStickyDisplayPerPaxKrw(row, 'childNoBed', originSource)
    if (u == null) return null
    sum += u * pax.childNoBed
  }
  if (pax.infant > 0) {
    const u = getStickyDisplayPerPaxKrw(row, 'infant', originSource)
    if (u == null) return null
    sum += u * pax.infant
  }
  return sum
}
