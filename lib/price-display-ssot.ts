import type { PublicPricePromotionView } from '@/lib/public-product-extras'

/**
 * 상세 가격 카드 SSOT (사용자 노출)
 *
 * 절대 원칙:
 * - 1인 객실 사용료·현지합류·선택관광 등 **부가요금은 이 SSOT의 성인1인 출발가(`selectedDeparturePrice`)에 포함하지 않는다.**
 *   해당 항목은 `singleRoomSurcharge*`·불포함 탭 등 별도 축에서만 다룬다.
 * - `displayPriceBeforeCoupon` / 취소선 금액은 DB `basePrice`·대표가·등록가를 **직접** 넣지 않는다.
 * - 오직 `selectedDeparturePrice + couponDiscountAmount` 로만 계산한다.
 * - `couponDiscountAmount`는 프로모에서 **basePrice·salePrice 쌍이 모두 있을 때만** (sale−base 역) `base−sale`로 추정한다.
 *   `basePrice`만 있고 달력가와의 차로만 깎는 방식(base−current)은 사용하지 않는다(취소선이 등록가와 동일해지는 것 방지).
 */

export type PriceDisplaySsot = {
  /** 달력에서 선택한 출발일·성인 1인 판매가 = 화면의 「현재가」 */
  selectedDeparturePrice: number | null
  /** 쿠폰·프로모 할인액(원). 프로모 base/sale 쌍으로만 산출; 없으면 0 */
  couponDiscountAmount: number
  /**
   * 쿠폰 적용 전(취소선) 표시 금액 = selectedDeparturePrice + couponDiscountAmount
   * 항상 위 식을 만족해야 함. 관리자 입력 참고가(adminInputReferencePrice 등)와 별개.
   */
  displayPriceBeforeCoupon: number | null
  /** 현재가 표시 = selectedDeparturePrice (동일 값, 검증용) */
  displayFinalPrice: number | null
}

/** 내부: 프로모 스냅샷에서 할인액만 추출할 때 쓰는 입력. 노출 필드로 직접 쓰지 않음. */
type PromotionDiscountSource = Pick<PublicPricePromotionView, 'basePrice' | 'salePrice'>

function roundKrw(n: number): number {
  return Math.round(n)
}

export type PriceDisplayValidation = {
  ok: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 계산식·부등식 검증. preview/confirm/render 직전에 호출.
 * - displayPriceBeforeCoupon !== selectedDeparturePrice + couponDiscountAmount → error
 * - displayPriceBeforeCoupon < displayFinalPrice → error
 * - couponDiscountAmount === 0 인데 displayPriceBeforeCoupon 만 있으면 warning
 */
export function validatePriceDisplaySsot(s: PriceDisplaySsot): PriceDisplayValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const sel = s.selectedDeparturePrice
  const fin = s.displayFinalPrice
  const before = s.displayPriceBeforeCoupon
  const d = s.couponDiscountAmount

  if (sel != null && fin != null && sel !== fin) {
    errors.push('displayFinalPrice는 selectedDeparturePrice와 같아야 합니다.')
  }
  if (sel == null && fin != null) {
    errors.push('selectedDeparturePrice가 없는데 displayFinalPrice가 있습니다.')
  }

  if (before != null && sel != null) {
    const expected = roundKrw(sel + d)
    if (before !== expected) {
      errors.push(
        `displayPriceBeforeCoupon(${before}) !== selectedDeparturePrice(${sel}) + couponDiscountAmount(${d}) (= ${expected})`
      )
    }
    if (before < sel) {
      errors.push('displayPriceBeforeCoupon은 displayFinalPrice(현재가)보다 작을 수 없습니다.')
    }
  }

  if (before != null && d === 0) {
    warnings.push('couponDiscountAmount가 0인데 쿠폰 적용 전 금액(displayPriceBeforeCoupon)이 존재합니다.')
  }

  if (d > 0 && before == null) {
    errors.push('couponDiscountAmount > 0 인데 displayPriceBeforeCoupon이 없습니다.')
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * 사용자 상세 가격 카드용 SSOT 객체 생성.
 * @param selectedDeparturePrice 달력/성인1인 확정가 (유일한 현재가 소스)
 * @param promotion 프로모 스냅샷 — basePrice/salePrice는 **할인액 추정에만** 사용 (노출 직접 매핑 금지)
 */
export function buildPriceDisplaySsot(
  selectedDeparturePrice: number | null | undefined,
  promotion?: PromotionDiscountSource | null
): PriceDisplaySsot {
  const sel =
    Number.isFinite(selectedDeparturePrice) && (selectedDeparturePrice as number) > 0
      ? roundKrw(Number(selectedDeparturePrice))
      : null

  if (sel == null) {
    return {
      selectedDeparturePrice: null,
      couponDiscountAmount: 0,
      displayPriceBeforeCoupon: null,
      displayFinalPrice: null,
    }
  }

  const baseRaw = promotion?.basePrice
  const saleRaw = promotion?.salePrice
  const base =
    baseRaw != null && Number.isFinite(baseRaw) && baseRaw > 0 ? roundKrw(Number(baseRaw)) : null
  const sale =
    saleRaw != null && Number.isFinite(saleRaw) && saleRaw > 0 ? roundKrw(Number(saleRaw)) : null

  let couponDiscountAmount = 0
  if (base != null && sale != null && base > sale) {
    couponDiscountAmount = roundKrw(base - sale)
  }

  if (couponDiscountAmount > 0) {
    const displayPriceBeforeCoupon = roundKrw(sel + couponDiscountAmount)
    const out: PriceDisplaySsot = {
      selectedDeparturePrice: sel,
      couponDiscountAmount,
      displayPriceBeforeCoupon,
      displayFinalPrice: sel,
    }
    const v = validatePriceDisplaySsot(out)
    if (!v.ok && process.env.NODE_ENV !== 'production') {
      console.warn('[price-display-ssot]', v.errors.join('; '))
    }
    return out
  }

  return {
    selectedDeparturePrice: sel,
    couponDiscountAmount: 0,
    displayPriceBeforeCoupon: null,
    displayFinalPrice: sel,
  }
}

/** 관리자·프로모 메타 검수용: DB에 남은 base/sale은 “참고”일 뿐 사용자 취소선과 별개 */
export function adminInputReferencePrices(promotion: PromotionDiscountSource | null | undefined): {
  adminInputReferencePrice: number | null
  promoSaleReference: number | null
} {
  const baseRaw = promotion?.basePrice
  const saleRaw = promotion?.salePrice
  return {
    adminInputReferencePrice:
      baseRaw != null && Number.isFinite(baseRaw) && baseRaw > 0 ? roundKrw(Number(baseRaw)) : null,
    promoSaleReference:
      saleRaw != null && Number.isFinite(saleRaw) && saleRaw > 0 ? roundKrw(Number(saleRaw)) : null,
  }
}
