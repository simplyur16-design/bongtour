import type { PublicPricePromotionView } from '@/lib/public-product-extras'

/** 상세·견적에 고정으로 쓰는 무이자 안내 문구 */
export const CARD_INSTALLMENT_SUMMARY = '카드사별 무이자 혜택 가능'

/** 상세 데이터가 부족할 때 허용되는 보조 문구 */
export const CARD_INSTALLMENT_DISCLAIMER = '카드사별 무이자 혜택은 결제 시점 기준으로 확인됩니다.'
/** 메인 가격 숫자 바로 아래 고정 보조문구 */
export const PRICE_MAIN_AMOUNT_HINT = '쿠폰 할인 적용 기준 금액입니다.'

/**
 * 취소선 금액 — SSOT: displayPriceBeforeCoupon = selectedDeparturePrice + couponDiscountAmount
 */
export const COMPARE_PRICE_ROW_HINT =
  '현재 선택 출발일 가격 + 쿠폰 할인액 합산. 등록가·DB basePrice·대표가를 그대로 쓰지 않습니다.'

/** 선택 출발일 기준 절약 안내 (프로모 할인액이 있을 때) */
export function formatHeroDepartureSavingsLine(discountKrw: number): string {
  return `선택한 출발일 기준, 지금 예약 시 최대 ${discountKrw.toLocaleString('ko-KR')}원 절약`
}

/**
 * DB/공급사 문자열에 남아 있을 수 있는 구 표기를 최종 카피로 치환.
 */
export function normalizePromotionMarketingCopy(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null
  let s = String(raw).trim()
  s = s.replace(/카드사별\s*무이자\s*혜택(?!\s*가능)(?!은)/g, `${CARD_INSTALLMENT_SUMMARY}`)
  return s
}

/** 상세 `pricePromotionView` 텍스트 필드에 무이자 문구 정규화 적용 */
export function normalizePricePromotionViewCopy(
  v: PublicPricePromotionView | null | undefined
): PublicPricePromotionView | null {
  if (!v) return null
  return {
    ...v,
    savingsText: normalizePromotionMarketingCopy(v.savingsText) ?? v.savingsText ?? null,
    benefitTitle: normalizePromotionMarketingCopy(v.benefitTitle) ?? v.benefitTitle ?? null,
    couponText: normalizePromotionMarketingCopy(v.couponText) ?? v.couponText ?? null,
    couponCtaText: normalizePromotionMarketingCopy(v.couponCtaText) ?? v.couponCtaText ?? null,
    priceDisplayRaw: normalizePromotionMarketingCopy(v.priceDisplayRaw) ?? v.priceDisplayRaw ?? null,
    benefitRawText: normalizePromotionMarketingCopy(v.benefitRawText) ?? v.benefitRawText ?? null,
  }
}

/** 공급사 가격표 원문(연령 구분·동액 반복)과 실시간 견적 카드 혼동 방지 */
export const SUPPLIER_TIER_PRICE_TABLE_DISCLAIMER =
  '이 구간은 공급사 안내 원문입니다. 실제 1인 적용 금액은 상단 「실시간 견적」의 성인·아동·유아 금액(또는 상담 시 확인)을 우선하세요. 표에서 아동 행이 성인과 같은 금액으로 보여도 출발일·항공·연령 조건에 따라 달라질 수 있습니다.'

export function textLooksLikeSupplierAgeTierPriceTable(s: string | null | undefined): boolean {
  const t = (s ?? '').trim()
  if (t.length < 60) return false
  if (!/성인/.test(t)) return false
  if (!/아동|Extra\s*Bed|No\s*Bed|유아/i.test(t)) return false
  if (!/[\d]{2,3}(?:,\d{3})+\s*원|\d{5,7}\s*원/.test(t)) return false
  return true
}
