'use client'

import { useMemo } from 'react'
import type { TravelProduct, ProductPriceRow } from '@/app/components/travel/TravelProductDetail'
import KakaoCounselCta from '@/app/components/travel/KakaoCounselCta'
import ShareActions from '@/app/components/detail/ShareActions'
import {
  computeStickyDisplayQuotationTotal,
  getStickyDisplayPerPaxKrw,
} from '@/lib/public-sticky-pax-display'
import {
  advisoryForDepartureRow,
  findPriceRowForDateKey,
  quotePriceRowStrictForSelectedDate,
} from '@/lib/booking-departure-ssot'
import type { DeparturePriceCollectUiPhase } from '@/lib/departure-price-collect-ui'
import { departurePriceCollectUiCopy } from '@/lib/departure-price-collect-ui'
import { computeReturnDate, getProductTotalDays } from '@/lib/package-rules'
import {
  PAX_STEP_BUTTON_CLASS,
  PAX_STEP_DECREMENT_GLYPH,
  PAX_STEP_INCREMENT_GLYPH,
  STICKY_PAX_ROWS,
} from '@/lib/product-live-quote-pax-ui'

type Pax = { adult: number; childBed: number; childNoBed: number; infant: number }

type Props = {
  product: TravelProduct
  prices: ProductPriceRow[]
  selectedDate: string | null
  pax: Pax
  updatePax: (key: keyof Pax, delta: number) => void
  updateChildCombined: (delta: number) => void
  highRiskAlerts: string[]
  onBookingOpen: () => void
  onOpenDeparturePicker: () => void
  variant?: 'desktop' | 'mobile'
  fromScreen: 'product_detail_desktop' | 'product_detail_mobile'
  departureConditionLine?: string | null
  heroTripDepartureDisplay?: string | null
  heroTripReturnDisplay?: string | null
  explicitPriceRow?: ProductPriceRow | null
  modetourStickyLocalPayLine?: string | null
  isCollectingPrices?: boolean
  priceCollectUiPhase?: DeparturePriceCollectUiPhase
  masterTotalDays?: number | null
  departureDateFrom?: string | null
}

export default function ProductLiveQuoteCard({
  product,
  prices,
  selectedDate,
  pax,
  updatePax,
  highRiskAlerts: _highRiskAlerts,
  onBookingOpen,
  onOpenDeparturePicker: _onOpenDeparturePicker,
  variant = 'desktop',
  fromScreen,
  departureConditionLine: _departureConditionLine,
  heroTripDepartureDisplay: _heroTripDepartureDisplay,
  heroTripReturnDisplay: _heroTripReturnDisplay,
  modetourStickyLocalPayLine: _modetourStickyLocalPayLine,
  updateChildCombined,
  explicitPriceRow,
  isCollectingPrices = false,
  priceCollectUiPhase = 'idle',
  masterTotalDays,
  departureDateFrom,
}: Props) {
  const priceRow = useMemo(
    () => quotePriceRowStrictForSelectedDate(prices, selectedDate, explicitPriceRow ?? null),
    [prices, selectedDate, explicitPriceRow]
  )

  const rowForAdvisory = useMemo(
    () => findPriceRowForDateKey(prices, selectedDate),
    [prices, selectedDate]
  )
  const departureAdvisoryLabel = useMemo(
    () => advisoryForDepartureRow(rowForAdvisory, isCollectingPrices),
    [rowForAdvisory, isCollectingPrices]
  )

  const counselPricingMode = useMemo(() => {
    const d = selectedDate?.trim()
    if (!d) return null
    if (priceRow) return 'schedule_price'
    return 'schedule_selected_pending_quote'
  }, [selectedDate, priceRow])

  const quotationTotal = useMemo(() => {
    if (!priceRow) return null
    return computeStickyDisplayQuotationTotal(priceRow, pax, product.originSource)
  }, [priceRow, pax, product.originSource])
  const localFeePerPerson = product.mandatoryLocalFee ?? null
  const totalDays = getProductTotalDays(product, masterTotalDays)
  const computedReturnDate = useMemo(() => {
    const dep = selectedDate ?? departureDateFrom ?? null
    return computeReturnDate(dep, totalDays)
  }, [selectedDate, departureDateFrom, totalDays])
  const shareSummary = `${product.originCode} · ${product.destination} · ${product.duration}${product.airline ? ` · ${product.airline}` : ''} · 출발 ${selectedDate ?? '미선택'}${computedReturnDate ? ` · 귀국 ${computedReturnDate}` : ''}`

  const isMobile = variant === 'mobile'
  const pad = isMobile ? 'p-4' : 'p-6'

  const showCollectingBanner =
    isCollectingPrices &&
    (priceCollectUiPhase === 'collecting' || priceCollectUiPhase === 'delayed_collecting')
  const showPendingQuoteBanner = !isCollectingPrices && priceCollectUiPhase === 'pending_quote'

  return (
    <div className={`bt-card-strong border-2 border-bt-border-soft ${pad}`}>
      {showCollectingBanner ? (
        <div
          className={`mb-3 rounded-lg border px-3 py-2.5 text-center text-[12px] leading-relaxed ${
            priceCollectUiPhase === 'delayed_collecting'
              ? 'border-amber-200 bg-amber-50/95 text-amber-950'
              : 'border-bt-border-soft bg-bt-surface-alt text-bt-body'
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold text-bt-title">{departurePriceCollectUiCopy.cardCollectingPrimary}</p>
          {priceCollectUiPhase === 'delayed_collecting' ? (
            <p className="mt-1 text-bt-meta">{departurePriceCollectUiCopy.cardCollectingDelayed}</p>
          ) : (
            <p className="mt-1 text-[11px] text-bt-meta">{departurePriceCollectUiCopy.overlayBodyPrimary}</p>
          )}
          <p className="mt-2 text-[11px] text-bt-subtle">
            예약 확정이 아닙니다. 요금 확인이 지연되어도 예약 요청 접수는 가능합니다.
          </p>
        </div>
      ) : null}
      {showPendingQuoteBanner ? (
        <div
          className="mb-3 rounded-lg border border-bt-border-soft bg-bt-surface-alt px-3 py-2.5 text-center text-[12px] leading-relaxed text-bt-body"
          role="status"
        >
          {departurePriceCollectUiCopy.cardPendingQuoteHint}
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#1F1B2D]">인원</p>
        <div className="space-y-2.5">
          {STICKY_PAX_ROWS.map((row) => {
            const isChildRow = row.key === 'child'
            const priceSlot = isChildRow ? 'childBed' : row.key
            const unit =
              priceRow != null ? getStickyDisplayPerPaxKrw(priceRow, priceSlot, product.originSource) : null
            const count = isChildRow ? pax.childBed + pax.childNoBed : pax[row.key]
            const atMin = count <= row.minVal
            const onDecrease = () => (isChildRow ? updateChildCombined(-1) : updatePax(row.key, -1))
            const onIncrease = () => (isChildRow ? updateChildCombined(1) : updatePax(row.key, 1))
            return (
              <div
                key={row.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#DAD4EE] bg-[#FAFAFC] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1F1B2D]">{row.label}</div>
                  <div className="text-[10px] text-bt-meta">{row.ageLine}</div>
                  {unit != null && unit > 0 && priceRow != null ? (
                    <div className="mt-0.5 text-xs font-semibold tabular-nums text-[#85510B]">
                      ₩{unit.toLocaleString('ko-KR')} /인
                    </div>
                  ) : null}
                </div>
                <div className="grid h-9 w-[7rem] shrink-0 grid-cols-[2rem_1fr_2rem] items-center gap-1">
                  <button
                    type="button"
                    onClick={onDecrease}
                    disabled={atMin}
                    className={PAX_STEP_BUTTON_CLASS}
                    aria-label={`${row.label} 감소`}
                  >
                    {PAX_STEP_DECREMENT_GLYPH}
                  </button>
                  <span className="min-w-[28px] text-center text-lg font-bold tabular-nums text-[#1F1B2D]">
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={onIncrease}
                    className={PAX_STEP_BUTTON_CLASS}
                    aria-label={`${row.label} 증가`}
                  >
                    {PAX_STEP_INCREMENT_GLYPH}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-bt-meta">
          ※ 아동 요금은 성인과 동일. 유아는 좌석 미배정 별도 요금.
        </p>
      </div>
      <div className="mt-3 space-y-2">
        <KakaoCounselCta
          variant="kakaoSoft"
          intent="departure"
          fromScreen={fromScreen}
          productId={String(product.id)}
          listingProductNumber={product.originCode}
          productTitle={product.title}
          originSource={product.originSource}
          originCode={product.originCode}
          selectedDepartureDate={selectedDate}
          selectedDepartureId={priceRow?.id ? String(priceRow.id) : null}
          preferredDepartureDate={null}
          pax={pax}
          quotationKrwTotal={quotationTotal}
          localFeePerPerson={localFeePerPerson}
          localFeeCurrency={product.mandatoryCurrency ?? null}
          advisoryLabel={departureAdvisoryLabel}
          pricingMode={counselPricingMode}
          isCollectingPrices={isCollectingPrices}
        />
        {showCollectingBanner || showPendingQuoteBanner ? (
          <p className="text-center text-[11px] leading-relaxed text-bt-subtle">
            {showCollectingBanner
              ? departurePriceCollectUiCopy.ctaHintWhileCollecting
              : departurePriceCollectUiCopy.ctaHintPendingQuote}
          </p>
        ) : null}
        <p className="mt-1.5 text-center text-[11px] leading-relaxed text-bt-meta">
          상품·출발일·인원 요약은 상담 채널로 전달됩니다. 전화번호(권장)·문의 내용을 보완해 주세요.
        </p>
        <p className="mt-0.5 text-center text-[11px] text-bt-subtle">
          입력창이 비어 있으면 복사된 요약을 붙여넣어 주세요.
        </p>
      </div>
      <ShareActions title={product.title} summaryLine={shareSummary} className="mt-2" />
      <button
        type="button"
        onClick={onBookingOpen}
        className="mt-3 w-full bt-btn-secondary"
      >
        예약 요청 접수
      </button>
    </div>
  )
}
