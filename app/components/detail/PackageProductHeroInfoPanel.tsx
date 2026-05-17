'use client'

import {
  ComparePriceRow,
  CurrentPriceRow,
  ProductDetailTitle,
  ProductMetaChips,
} from '@/app/components/detail/product-detail-visual'
import type { ProductMetaChip } from '@/lib/product-meta-chips'
import type { PriceDisplaySsot } from '@/lib/price-display-ssot'
import type { FlightLegTwoLineDisplay } from '@/lib/flight-user-display'
import { CARD_INSTALLMENT_DISCLAIMER, CARD_INSTALLMENT_SUMMARY } from '@/lib/promotion-copy-normalize'
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
  onChangeDepartureDate: () => void
  showChangeDepartureCta?: boolean
  modetourStickyLocalPayLine?: string | null
}

function FlightLegTwoLineBlock({
  label,
  leg,
}: {
  label: string
  leg: FlightLegTwoLineDisplay | null | undefined
}) {
  return (
    <div className="flex gap-2.5 border-t border-[#DAD4EE]/30 py-1.5 first:border-t-0 first:pt-0">
      <span className="w-11 shrink-0 pt-0.5 text-[11px] font-medium text-bt-meta">{label}</span>
      {leg ? (
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 text-sm font-semibold text-[#1F1B2D]">
            <span className="bt-wrap">{leg.departureAirport}</span>
            <span className="bt-wrap tabular-nums text-right">{leg.departureAtText}</span>
          </div>
          <p className="bt-wrap mt-0.5 text-sm leading-relaxed text-[#1F1B2D]/85">
            {leg.flightNo ? `(${leg.flightNo}) ` : ''}
            <span className="inline-grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 align-top">
              <span>{leg.arrivalAirport}</span>
              <span className="tabular-nums text-right">{leg.arrivalAtText}</span>
            </span>
          </p>
        </div>
      ) : (
        <p className="text-sm text-[#1F1B2D]/80">상담 시 안내</p>
      )}
    </div>
  )
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
  heroDepartureDisplay: _heroDepartureDisplay,
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
  onChangeDepartureDate,
  showChangeDepartureCta = true,
  modetourStickyLocalPayLine,
}: PackageProductHeroInfoPanelProps) {
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
        <div className="mt-3 rounded-xl border border-bt-card-accent-border bg-bt-card-accent-soft p-2.5">
          <FlightLegTwoLineBlock label="가는편" leg={outboundFlight} />
          <FlightLegTwoLineBlock label="오는편" leg={inboundFlight} />
          {heroPriceSsot.selectedDeparturePrice != null ? (
            <>
              <div className="mt-2 flex flex-col gap-1.5">
                {heroPriceSsot.couponDiscountAmount > 0 && heroPriceSsot.displayPriceBeforeCoupon != null ? (
                  <ComparePriceRow amount={heroPriceSsot.displayPriceBeforeCoupon} />
                ) : null}
                <CurrentPriceRow amount={heroPriceSsot.selectedDeparturePrice} />
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

      {productMetaChips.length > 0 ? (
        <div className="mt-2 border-t border-bt-border-soft pt-2">
          <ProductMetaChips chips={productMetaChips} variant="light" className="w-full gap-1.5" />
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
    </>
  )
}
