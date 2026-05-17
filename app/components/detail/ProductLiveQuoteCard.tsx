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
  extractPaxAgeHintsFromSupplierText,
  paxAgeLineForSlot,
} from '@/lib/pax-age-hints'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import {
  advisoryForDepartureRow,
  findPriceRowForDateKey,
  quotePriceRowStrictForSelectedDate,
} from '@/lib/booking-departure-ssot'
import type { DeparturePriceCollectUiPhase } from '@/lib/departure-price-collect-ui'
import { departurePriceCollectUiCopy } from '@/lib/departure-price-collect-ui'
import { buildStickyPaxRows } from '@/lib/public-sticky-quote-display'
import { computeReturnDate, getProductTotalDays } from '@/lib/package-rules'

/** 인원 스테퍼 − / + (원형, 숫자와 겹치지 않도록 간격 확보) */
const PAX_STEP_ROUND_CLASS =
  'inline-flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-gray-100 text-base font-medium text-bt-title transition-colors hover:bg-gray-200 active:bg-gray-300 disabled:pointer-events-none disabled:opacity-40'

type Pax = { adult: number; childBed: number; childNoBed: number; infant: number }

type Props = {
  product: TravelProduct
  prices: ProductPriceRow[]
  selectedDate: string | null
  pax: Pax
  updatePax: (key: keyof Pax, delta: number) => void
  /** 하나투어·참좋은·ybtour 스티키 「아동」 통합 행용(침대·노베드 카운트 조절) */
  updateChildCombined: (delta: number) => void
  highRiskAlerts: string[]
  onBookingOpen: () => void
  onOpenDeparturePicker: () => void
  variant?: 'desktop' | 'mobile'
  fromScreen: 'product_detail_desktop' | 'product_detail_mobile'
  /** 최소출발·현재예약·출발확정 한 줄 (등록 본문 추출) */
  departureConditionLine?: string | null
  /** 히어로·여행핵심정보와 동일 출발·귀국 표시 (`formatHeroDateKorean` 등) */
  heroTripDepartureDisplay?: string | null
  heroTripReturnDisplay?: string | null
  /** 동일 일자에 여러 출발 행이 있을 때 `selectedDate`만으로는 부족할 때 — 이 행을 견적 SSOT로 사용 */
  explicitPriceRow?: ProductPriceRow | null
  /** 모두투어 전용: 출발일 변경 버튼 바로 아래 현지 지불경비(인당) */
  modetourStickyLocalPayLine?: string | null
  /** 전후 범위 on-demand 수집 중(선택일 SSOT 유지, 견적은 참고만) */
  isCollectingPrices?: boolean
  /** 상세에서 계산한 수집·지연·pending_quote UI 단계 */
  priceCollectUiPhase?: DeparturePriceCollectUiPhase
  /** 일정 N일 — `product.schedule.length` 또는 fit master */
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

  /** 상담 요약 참고용 — `pricingMode` 문자열과 동일하게 맞춤 */
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

  const paxAgeHaystack = useMemo(
    () =>
      [
        product.priceTableRawText,
        product.includedText,
        product.excludedText,
        product.infantAgeRuleText,
        product.childAgeRuleText,
      ]
        .filter((x): x is string => Boolean(x?.trim()))
        .join('\n'),
    [
      product.priceTableRawText,
      product.includedText,
      product.excludedText,
      product.infantAgeRuleText,
      product.childAgeRuleText,
    ]
  )
  const paxAgeExtracted = useMemo(() => extractPaxAgeHintsFromSupplierText(paxAgeHaystack), [paxAgeHaystack])

  const isMobile = variant === 'mobile'
  const pad = isMobile ? 'p-4' : 'p-6'
  const isModetourProduct = normalizeSupplierOrigin(product.originSource) === 'modetour'

  const stickyPaxRows = useMemo(
    () => buildStickyPaxRows(product.originSource, priceRow),
    [product.originSource, priceRow]
  )

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
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-bt-card-title">인원</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {stickyPaxRows.map((rowDef) => {
            if (rowDef.kind === 'childCombined') {
              const unit =
                priceRow != null ? getStickyDisplayPerPaxKrw(priceRow, 'childBed', product.originSource) : null
              const count = pax.childBed + pax.childNoBed
              const atMin = count <= 0
              const ageLine = paxAgeLineForSlot('childBed', paxAgeExtracted)
              const label = rowDef.label
              return (
                <div
                  key="child-combined"
                  className="flex flex-col items-center text-center rounded-xl border border-bt-border-soft bg-bt-surface-soft px-3 py-3"
                >
                  <div className="flex w-full min-h-[2.75rem] flex-col items-center justify-center gap-0.5">
                    <span className="text-sm font-semibold leading-snug text-bt-title">{label}</span>
                    {ageLine ? (
                      <p className="text-[11px] font-medium leading-snug text-bt-meta">{ageLine}</p>
                    ) : null}
                  </div>
                  <div className="mt-1 flex min-h-[2.75rem] w-full flex-col items-center justify-center">
                    {unit != null && priceRow != null ? (
                      <span className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0 tabular-nums leading-none">
                        <span className="text-[0.72em] font-bold text-bt-muted">₩</span>
                        <span className="text-xl font-extrabold tracking-tight text-bt-price sm:text-[1.35rem]">
                          {unit.toLocaleString('ko-KR')}
                        </span>
                        <span className="text-[11px] font-medium text-bt-meta">/인</span>
                      </span>
                    ) : (
                      <span className="text-sm font-medium leading-none text-bt-meta">상담 시 확인</span>
                    )}
                  </div>
                  <div className="mt-auto pt-2 flex w-full justify-center">
                    <div className="mt-3 flex w-full items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => updateChildCombined(-1)}
                        disabled={atMin}
                        className={PAX_STEP_ROUND_CLASS}
                        aria-label={`${label} 감소`}
                      >
                        −
                      </button>
                      <span className="flex-1 text-center text-lg font-bold tabular-nums text-bt-title">{count}</span>
                      <button
                        type="button"
                        onClick={() => updateChildCombined(1)}
                        className={PAX_STEP_ROUND_CLASS}
                        aria-label={`${label} 증가`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            const key = rowDef.paxKey
            const label = rowDef.label
            const unit =
              priceRow != null ? getStickyDisplayPerPaxKrw(priceRow, key, product.originSource) : null
            const count = pax[key]
            const atMin = key === 'adult' ? count <= 1 : count <= 0
            const ageLine = paxAgeLineForSlot(key, paxAgeExtracted)
            const noBedCounselCopy =
              isModetourProduct && key === 'childNoBed' && priceRow != null && unit == null
            return (
              <div
                key={key}
                className="flex flex-col items-center text-center rounded-xl border border-bt-border-soft bg-bt-surface-soft px-3 py-3"
              >
                <div className="flex w-full min-h-[2.75rem] flex-col items-center justify-center gap-0.5">
                  <span
                    className={`text-sm font-semibold leading-snug text-bt-title ${
                      key === 'adult' ? 'tracking-[0.18em]' : ''
                    }`}
                  >
                    {label}
                  </span>
                  {ageLine ? (
                    <p className="text-[11px] font-medium leading-snug text-bt-meta">{ageLine}</p>
                  ) : null}
                </div>
                <div className="mt-1 flex min-h-[2.75rem] w-full flex-col items-center justify-center">
                  {unit != null && priceRow != null ? (
                    <span className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0 tabular-nums leading-none">
                      <span className="text-[0.72em] font-bold text-bt-muted">₩</span>
                      <span className="text-xl font-extrabold tracking-tight text-bt-price sm:text-[1.35rem]">
                        {unit.toLocaleString('ko-KR')}
                      </span>
                      <span className="text-[11px] font-medium text-bt-meta">/인</span>
                    </span>
                  ) : noBedCounselCopy ? (
                    <span className="text-sm font-medium leading-none text-bt-meta">상담 후 안내</span>
                  ) : (
                    <span className="text-sm font-medium leading-none text-bt-meta">상담 시 확인</span>
                  )}
                </div>
                <div className="mt-auto pt-2 flex w-full justify-center">
                  <div className="mt-3 flex w-full items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => updatePax(key, -1)}
                      disabled={atMin}
                      className={PAX_STEP_ROUND_CLASS}
                      aria-label={`${label} 감소`}
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-lg font-bold tabular-nums text-bt-title">{count}</span>
                    <button
                      type="button"
                      onClick={() => updatePax(key, 1)}
                      className={PAX_STEP_ROUND_CLASS}
                      aria-label={`${label} 증가`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {isModetourProduct && pax.childNoBed > 0 && (
          <p className="mt-2 text-center text-[11px] text-bt-meta">
            아동(NO BED)은 관리자가 설정한 할인 요금이 적용됩니다.
          </p>
        )}
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
