'use client'

import type { PublicPricePromotionView } from '@/lib/public-product-extras'
import {
  SUPPLIER_TIER_PRICE_TABLE_DISCLAIMER,
  textLooksLikeSupplierAgeTierPriceTable,
} from '@/lib/promotion-copy-normalize'

type Props = {
  promotion: PublicPricePromotionView | null
  benefitSummary: string | null
  promotionLabelsRaw: string | null
  priceFrom: number | null
  priceCurrency: string | null
}

export function hasPricePromotionSummaryContent(p: Props): boolean {
  const base = p.promotion?.basePrice ?? null
  const sale = p.promotion?.salePrice ?? null
  const hasStructured = base != null || sale != null
  const hasRaw =
    Boolean(p.promotion?.priceDisplayRaw?.trim()) ||
    Boolean(p.promotion?.benefitRawText?.trim()) ||
    Boolean(p.promotion?.savingsText?.trim()) ||
    Boolean(p.promotion?.benefitTitle?.trim()) ||
    Boolean(p.promotion?.couponText?.trim())
  const hasFallback = Boolean(p.benefitSummary?.trim()) || Boolean(p.promotionLabelsRaw?.trim())
  const hasRepresentative = p.priceFrom != null && Boolean(p.priceCurrency?.trim())
  return hasStructured || hasRaw || hasFallback || hasRepresentative
}

/**
 * 공급사 원문 기반 참고 블록. 사용자 상세 가격 카드(SSOT: selectedDeparturePrice + couponDiscountAmount)와 별개.
 * basePrice를 취소선·「기준가」로 노출하지 않는다(등록가 혼동 방지).
 */
export default function ProductPromotionSummary({
  promotion,
  benefitSummary,
  promotionLabelsRaw,
  priceFrom,
  priceCurrency,
}: Props) {
  const base = promotion?.basePrice ?? null
  const sale = promotion?.salePrice ?? null
  const hasStructured = base != null || sale != null
  const hasRaw =
    Boolean(promotion?.priceDisplayRaw?.trim()) ||
    Boolean(promotion?.benefitRawText?.trim()) ||
    Boolean(promotion?.savingsText?.trim()) ||
    Boolean(promotion?.benefitTitle?.trim()) ||
    Boolean(promotion?.couponText?.trim())
  const hasFallback = Boolean(benefitSummary?.trim()) || Boolean(promotionLabelsRaw?.trim())
  const hasRepresentative = priceFrom != null && Boolean(priceCurrency?.trim())

  if (!hasStructured && !hasRaw && !hasFallback && !hasRepresentative) return null

  return (
    <section className="rounded-xl border border-bt-border-soft bg-bt-brand-blue-soft/80 p-4 text-sm text-bt-body">
      <p className="text-xs font-semibold uppercase tracking-wide text-bt-title">가격·혜택 (참고)</p>
      <p className="mt-1 text-xs leading-relaxed text-bt-body">
        아래 금액·문구는 공급사 화면 기준으로 정리한 참고 정보입니다. 상단 상품 가격 영역의 「쿠폰 적용 전 금액」·메인 표시 금액과
        숫자가 다를 수 있으며, 등록 시 대표가와도 다릅니다.
      </p>
      {(hasStructured || hasRepresentative) && (
        <div className="mt-3 space-y-2 text-xs text-bt-meta">
          {hasStructured && (
            <p className="rounded border border-bt-border-soft bg-bt-surface/80 p-2 leading-relaxed">
              <span className="font-semibold text-bt-title">공급사 추출 참고(메타)</span>
              {base != null ? (
                <span className="block tabular-nums">base(원문 추출): {base.toLocaleString()}원</span>
              ) : null}
              {sale != null ? (
                <span className="block tabular-nums">sale(원문 추출): {sale.toLocaleString()}원</span>
              ) : null}
              {base != null && sale == null ? (
                <span className="mt-1 block text-[11px] text-amber-800">
                  sale이 없으면 사용자 화면 취소선(쿠폰 적용 전)은 SSOT상 표시되지 않을 수 있습니다.
                </span>
              ) : null}
            </p>
          )}
          {!hasStructured && hasRepresentative && (
            <span className="text-xl font-bold tabular-nums text-bt-price sm:text-2xl">
              대표(등록 참고) {priceFrom!.toLocaleString()} {priceCurrency}
            </span>
          )}
        </div>
      )}
      {promotion?.savingsText?.trim() && (
        <p className="mt-2 text-sm text-bt-title">{promotion.savingsText}</p>
      )}
      {promotion?.benefitTitle?.trim() && (
        <p className="mt-1 font-medium text-bt-title">{promotion.benefitTitle}</p>
      )}
      {promotion?.couponText?.trim() && (
        <p className="mt-1 text-sm text-bt-body">{promotion.couponText}</p>
      )}
      {promotion?.couponCtaText?.trim() && (
        <p className="mt-1 text-xs text-bt-muted">{promotion.couponCtaText}</p>
      )}
      {promotion?.priceDisplayRaw?.trim() && !hasStructured && (
        <div className="mt-2 rounded border border-bt-border-soft bg-bt-surface/80 p-2 text-xs text-bt-body">
          {textLooksLikeSupplierAgeTierPriceTable(promotion.priceDisplayRaw) ? (
            <p className="mb-2 rounded border border-amber-200/80 bg-amber-50/90 p-2 text-[11px] leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              {SUPPLIER_TIER_PRICE_TABLE_DISCLAIMER}
            </p>
          ) : null}
          <p className="whitespace-pre-wrap">{promotion.priceDisplayRaw}</p>
        </div>
      )}
      {promotion?.benefitRawText?.trim() && (
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-bt-meta">{promotion.benefitRawText}</p>
      )}
      {benefitSummary?.trim() && !promotion?.benefitRawText?.trim() && (
        <p className="mt-2 text-xs text-bt-body">{benefitSummary}</p>
      )}
      {promotionLabelsRaw?.trim() && !promotion?.couponText?.trim() && (
        <p className="mt-1 text-xs text-bt-meta">{promotionLabelsRaw}</p>
      )}
    </section>
  )
}
