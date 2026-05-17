'use client'

import { useMemo } from 'react'
import { computeReturnDate, getProductTotalDays } from '@/lib/package-rules'
import {
  ComparePriceRow,
  CurrentPriceRow,
  HERO_DATE_LABEL_CLASS,
  HERO_DATE_VALUE_CLASS,
  ProductDetailTitle,
  ProductMetaChips,
} from '@/app/components/detail/product-detail-visual'
import type { ProductMetaChip } from '@/lib/product-meta-chips'
import type { PriceDisplaySsot } from '@/lib/price-display-ssot'
import {
  CARD_INSTALLMENT_DISCLAIMER,
  CARD_INSTALLMENT_SUMMARY,
  PRICE_MAIN_AMOUNT_HINT,
} from '@/lib/promotion-copy-normalize'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'

export type PackageProductHeroInfoPanelProps = {
  showTitle?: boolean
  dataSourceLabel: string
  title: string
  originCode: string
  destination: string
  durationLabel: string
  airline?: string | null
  heroDepartureDisplay: string | null
  duration: string
  masterTotalDays?: number | null
  selectedDepartureIso?: string | null
  departureDateFrom?: string | null
  heroPriceSsot: PriceDisplaySsot
  heroDiscountSavingsLine: string | null
  heroBenefitWhenNoDiscount: string | null
  heroCouponText: string | null
  departureConditionLine?: string | null
  productMetaChips: ProductMetaChip[]
  listingKind?: string | null
  airportTransferType?: string | null
  onChangeDepartureDate: () => void
  /** false when no departure price rows — hides 출발일 변경 CTA */
  showChangeDepartureCta?: boolean
  modetourStickyLocalPayLine?: string | null
}

/** 패키지 상세 — 코드·날짜·가격·무이자·출발확정·메타 칩 */
export default function PackageProductHeroInfoPanel({
  showTitle = false,
  dataSourceLabel: _dataSourceLabel,
  title,
  originCode,
  destination,
  durationLabel,
  airline,
  heroDepartureDisplay,
  duration,
  masterTotalDays,
  selectedDepartureIso,
  departureDateFrom,
  heroPriceSsot,
  heroDiscountSavingsLine,
  heroBenefitWhenNoDiscount,
  heroCouponText,
  departureConditionLine,
  productMetaChips,
  listingKind,
  airportTransferType,
  onChangeDepartureDate,
  showChangeDepartureCta = true,
  modetourStickyLocalPayLine,
}: PackageProductHeroInfoPanelProps) {
  const totalDays = getProductTotalDays({ duration }, masterTotalDays)
  const computedReturnDate = useMemo(() => {
    const dep = selectedDepartureIso ?? departureDateFrom ?? null
    return computeReturnDate(dep, totalDays)
  }, [selectedDepartureIso, departureDateFrom, totalDays])

  const showPriceBlock =
    heroPriceSsot.selectedDeparturePrice != null || heroBenefitWhenNoDiscount || heroCouponText

  return (
    <>
      {showTitle ? (
        <ProductDetailTitle
          title={title}
          className="bt-wrap mt-4 text-2xl font-black leading-[1.45] tracking-[0.02em] text-bt-title sm:text-3xl"
        />
      ) : null}

      <p className="bt-wrap mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-relaxed text-bt-body">
        <span className="bt-code-wrap font-mono text-xs font-semibold text-bt-meta">{originCode}</span>
        <span className="text-bt-disabled">·</span>
        <span className="font-medium text-bt-title">{destination}</span>
        <span className="text-bt-disabled">·</span>
        <span>{durationLabel}</span>
        {airline?.trim() ? (
          <>
            <span className="text-bt-disabled">·</span>
            <span className="text-bt-muted">{airline.trim()}</span>
          </>
        ) : null}
      </p>

      {showPriceBlock ? (
        <div className="mt-4 rounded-xl border border-bt-card-accent-border bg-bt-card-accent-soft p-4">
          <div className="space-y-1 text-xs">
            <p className="flex items-center justify-between gap-3">
              <span className={HERO_DATE_LABEL_CLASS}>출발일</span>
              <span className={HERO_DATE_VALUE_CLASS}>
                {heroDepartureDisplay ?? '선택 가능 출발일 자동 선택'}
              </span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className={HERO_DATE_LABEL_CLASS}>귀국일</span>
              <span className={HERO_DATE_VALUE_CLASS}>
                {computedReturnDate ? computedReturnDate : '상담 시 안내'}
              </span>
            </p>
          </div>
          {heroPriceSsot.selectedDeparturePrice != null ? (
            <>
              <div className="mt-3 flex flex-col gap-2">
                {heroPriceSsot.couponDiscountAmount > 0 && heroPriceSsot.displayPriceBeforeCoupon != null ? (
                  <ComparePriceRow amount={heroPriceSsot.displayPriceBeforeCoupon} />
                ) : null}
                <CurrentPriceRow amount={heroPriceSsot.selectedDeparturePrice} />
                <p className="text-[11px] text-bt-meta">{PRICE_MAIN_AMOUNT_HINT}</p>
              </div>
              {heroDiscountSavingsLine ? (
                <p className="bt-wrap mt-2 text-center text-sm font-semibold text-bt-card-accent-strong">
                  {heroDiscountSavingsLine}
                </p>
              ) : null}
            </>
          ) : null}
          {heroBenefitWhenNoDiscount ? (
            <p className="bt-wrap mt-2 text-center text-xs text-bt-meta">{heroBenefitWhenNoDiscount}</p>
          ) : null}
          {heroCouponText ? (
            <p className="bt-wrap mt-1 text-center text-xs text-bt-muted">{heroCouponText}</p>
          ) : null}
          <div className="mt-3 border-t border-bt-card-accent-border/40 pt-3 text-center">
            <p className="text-xs font-bold text-bt-card-accent-strong">{CARD_INSTALLMENT_SUMMARY}</p>
            <p className="bt-wrap mt-1 text-[11px] leading-relaxed text-bt-meta">{CARD_INSTALLMENT_DISCLAIMER}</p>
          </div>
        </div>
      ) : null}

      {departureConditionLine?.trim() ? (
        <p className="mt-3 text-center text-[11px] font-semibold leading-snug text-bt-card-accent-strong">
          {departureConditionLine.trim()}
        </p>
      ) : null}

      {productMetaChips.length > 0 ? (
        <div className="mt-3 border-t border-bt-border-soft pt-3">
          <ProductMetaChips chips={productMetaChips} variant="light" className="w-full" />
        </div>
      ) : null}

      {isAirHotelFreeListingForUi(listingKind) ? (
        <div className="mt-2">
          <span className="inline-flex rounded-full border border-bt-card-accent-border bg-bt-card-accent-soft px-2.5 py-1 text-xs font-semibold text-bt-card-title">
            {airportTransferType === 'BOTH'
              ? '픽업·샌딩 포함'
              : airportTransferType === 'PICKUP'
                ? '공항 픽업 포함'
                : airportTransferType === 'SENDING'
                  ? '공항 샌딩 포함'
                  : '공항 이동 불포함'}
          </span>
        </div>
      ) : null}

      {showChangeDepartureCta ? (
        <>
          <button
            type="button"
            onClick={onChangeDepartureDate}
            className="mt-4 w-full rounded-xl bg-[#1F1B2D] py-3 font-medium text-white transition hover:bg-[#2c2740]"
          >
            출발일 변경
          </button>
          {modetourStickyLocalPayLine?.trim() ? (
            <p className="mt-2 text-center text-[11px] font-semibold leading-snug text-bt-body">
              {modetourStickyLocalPayLine.trim()}
            </p>
          ) : null}
        </>
      ) : null}
    </>
  )
}
