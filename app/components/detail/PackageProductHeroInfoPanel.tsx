'use client'

import {
  KrwAmountDisplay,
  ProductDetailTitle,
  ProductMetaChips,
} from '@/app/components/detail/product-detail-visual'
import type { ProductMetaChip } from '@/lib/product-meta-chips'
import type { PriceDisplaySsot } from '@/lib/price-display-ssot'
import FlightLegTwoLineBlock from '@/app/components/detail/FlightLegTwoLineBlock'
import type { FlightLegTwoLineDisplay } from '@/lib/flight-user-display'
import {
  CARD_INSTALLMENT_DISCLAIMER,
  CARD_INSTALLMENT_SUMMARY,
  COMPARE_PRICE_ROW_HINT,
} from '@/lib/promotion-copy-normalize'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'
import { formatPublicAirlineDisplay } from '@/lib/airline-iata-public-display-ssot'
import { formatPublicDestinationDisplayLabel } from '@/lib/bongtour-product-display-title-ssot'
import {
  buildSimilarItineraryCompareHrefFromProduct,
  SIMILAR_ITINERARY_COMPARE_CTA_LABEL,
  SIMILAR_ITINERARY_COMPARE_PATH,
} from '@/lib/similar-itinerary-compare-href'
import Link from 'next/link'

export type PackageProductHeroInfoPanelProps = {
  showTitle?: boolean
  dataSourceLabel: string
  title: string
  originCode: string
  destination: string
  /** 비교 place 토큰용 — destination과 함께 전달 */
  primaryDestination?: string | null
  durationLabel: string
  airline?: string | null
  heroDepartureDisplay: string | null
  heroReturnDisplay?: string | null
  duration: string
  masterTotalDays?: number | null
  selectedDepartureIso?: string | null
  departureDateFrom?: string | null
  outboundFlight?: FlightLegTwoLineDisplay | null
  inboundFlight?: FlightLegTwoLineDisplay | null
  heroPriceSsot: PriceDisplaySsot
  heroDiscountSavingsLine: string | null
  heroBenefitWhenNoDiscount: string | null
  heroCouponText: string | null
  departureConditionLine?: string | null
  productMetaChips: ProductMetaChip[]
  listingKind?: string | null
  airportTransferType?: string | null
  /** 인천·김포(서울권)는 null — 부산·청주·대구·제주만 표기 */
  departureAirportLabelDisplay?: string | null
  onChangeDepartureDate: () => void
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
  primaryDestination = null,
  durationLabel,
  airline,
  heroDepartureDisplay,
  heroReturnDisplay,
  duration: _duration,
  masterTotalDays: _masterTotalDays,
  selectedDepartureIso: _selectedDepartureIso,
  departureDateFrom: _departureDateFrom,
  outboundFlight,
  inboundFlight,
  heroPriceSsot,
  heroDiscountSavingsLine,
  heroBenefitWhenNoDiscount,
  heroCouponText,
  departureConditionLine,
  productMetaChips,
  listingKind,
  airportTransferType,
  departureAirportLabelDisplay,
  onChangeDepartureDate,
  showChangeDepartureCta = true,
  modetourStickyLocalPayLine,
}: PackageProductHeroInfoPanelProps) {
  const isAirHotelFree = isAirHotelFreeListingForUi(listingKind)
  const heroMetaChips = isAirHotelFree
    ? productMetaChips.filter((c) => c.kind !== 'shopping' && c.kind !== 'freeTime')
    : productMetaChips

  const showPriceBlock =
    heroPriceSsot.selectedDeparturePrice != null || heroBenefitWhenNoDiscount || heroCouponText
  // REGRESSION-FREEZE[public-hero-airline-iata-ko]: 히어로 항공 줄 IATA→한글 — manifest
  const airlineDisplay = formatPublicAirlineDisplay(airline)
  // REGRESSION-FREEZE[public-card-no-kr-departure-place]: 상세 dest 출발허브 제거 — manifest
  const destinationDisplay = formatPublicDestinationDisplayLabel(destination)
  // REGRESSION-FREEZE[similar-itinerary-compare-entry]: 히어로 가격 아래 사실 비교 CTA — manifest
  const similarCompareHref = buildSimilarItineraryCompareHrefFromProduct({
    primaryDestination,
    destination,
    duration: durationLabel || _duration,
    title,
    totalDays: _masterTotalDays,
  })

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
        <span className="font-medium text-bt-title">{destinationDisplay}</span>
        <span className="text-bt-disabled">·</span>
        <span>{durationLabel}</span>
        {airlineDisplay ? (
          <>
            <span className="text-bt-disabled">·</span>
            <span className="text-bt-muted">{airlineDisplay}</span>
          </>
        ) : null}
        {departureAirportLabelDisplay?.trim() ? (
          <>
            <span className="text-bt-disabled">·</span>
            <span className="font-medium text-teal-800">{departureAirportLabelDisplay.trim()}</span>
          </>
        ) : null}
      </p>

      {heroDepartureDisplay || heroReturnDisplay ? (
        <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 rounded-xl border border-[#DAD4EE]/60 bg-[#FAFAFC] px-3 py-2.5 text-center text-sm">
          <span className="text-bt-meta">출발</span>
          <span className="font-semibold tabular-nums text-bt-title">{heroDepartureDisplay ?? '—'}</span>
          <span className="text-bt-meta">~</span>
          <span className="text-bt-meta">귀국</span>
          <span className="font-semibold tabular-nums text-bt-title">{heroReturnDisplay ?? '상담 시 안내'}</span>
        </div>
      ) : null}

      {showPriceBlock ? (
        <div className="mt-3 rounded-xl border border-bt-card-accent-border bg-bt-card-accent-soft p-2.5">
          <FlightLegTwoLineBlock label="가는편" leg={outboundFlight} />
          <FlightLegTwoLineBlock label="오는편" leg={inboundFlight} />
          {heroPriceSsot.selectedDeparturePrice != null ? (
            <>
              <div className="mt-2 flex w-full flex-col items-center gap-1.5 text-center">
                {heroPriceSsot.couponDiscountAmount > 0 && heroPriceSsot.displayPriceBeforeCoupon != null ? (
                  <div className="flex w-full flex-col items-center gap-0.5 text-xs">
                    <p className="font-semibold text-bt-meta">쿠폰 적용 전 금액</p>
                    <p className="text-[10px] leading-snug text-bt-body">{COMPARE_PRICE_ROW_HINT}</p>
                    <span className="inline-flex items-baseline gap-0.5 tabular-nums text-slate-900 line-through">
                      <span className="text-[0.65em] font-semibold text-slate-500">₩</span>
                      <span className="font-bold">
                        {heroPriceSsot.displayPriceBeforeCoupon.toLocaleString('ko-KR')}
                      </span>
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-center">
                  <KrwAmountDisplay amount={heroPriceSsot.selectedDeparturePrice} size="2xl" />
                </div>
              </div>
              {heroDiscountSavingsLine ? (
                <p className="bt-wrap mt-1.5 text-center text-sm font-semibold text-bt-card-accent-strong">
                  {heroDiscountSavingsLine}
                </p>
              ) : null}
            </>
          ) : null}
          {heroBenefitWhenNoDiscount ? (
            <p className="bt-wrap mt-1.5 text-center text-xs text-bt-meta">{heroBenefitWhenNoDiscount}</p>
          ) : null}
          {heroCouponText ? (
            <p className="bt-wrap mt-1 text-center text-xs text-bt-muted">{heroCouponText}</p>
          ) : null}
          <div className="mt-2 border-t border-bt-card-accent-border/40 pt-2 text-center">
            <p className="text-xs font-bold text-bt-card-accent-strong">{CARD_INSTALLMENT_SUMMARY}</p>
            <p className="bt-wrap mt-0.5 text-[11px] leading-relaxed text-bt-meta">{CARD_INSTALLMENT_DISCLAIMER}</p>
          </div>
        </div>
      ) : null}

      {departureConditionLine?.trim() ? (
        <p className="mt-2 text-center text-[11px] font-semibold leading-snug text-bt-card-accent-strong">
          {departureConditionLine.trim()}
        </p>
      ) : null}

      {heroMetaChips.length > 0 ? (
        <div className="mt-2 border-t border-bt-border-soft pt-2">
          <ProductMetaChips chips={heroMetaChips} variant="light" className="w-full gap-1.5" />
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
            className="mt-3 w-full rounded-xl bg-[#1F1B2D] py-2.5 font-medium text-white transition hover:bg-[#2c2740]"
          >
            출발일 변경
          </button>
          {modetourStickyLocalPayLine?.trim() ? (
            <p className="mt-1.5 text-center text-[11px] font-semibold leading-snug text-bt-body">
              {modetourStickyLocalPayLine.trim()}
            </p>
          ) : null}
        </>
      ) : null}

      {/* REGRESSION-FREEZE[similar-itinerary-compare-entry]: 히어로 사실 비교 CTA 항상 노출 — manifest */}
      <Link
        href={similarCompareHref ?? SIMILAR_ITINERARY_COMPARE_PATH}
        className="mt-2.5 flex w-full items-center justify-center rounded-xl border border-[#2f8fc7]/45 bg-[#e8f4fc] px-3 py-2.5 text-[13px] font-bold text-[#0e7cc0] transition hover:border-[#2f8fc7] hover:bg-[#dceef9]"
      >
        {SIMILAR_ITINERARY_COMPARE_CTA_LABEL}
      </Link>
    </>
  )
}
