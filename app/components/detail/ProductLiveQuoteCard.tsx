'use client'

import { useMemo } from 'react'
import type { TravelProduct, ProductPriceRow } from '@/app/components/travel/TravelProductDetail'
import KakaoCounselCta from '@/app/components/travel/KakaoCounselCta'
import ShareActions from '@/app/components/detail/ShareActions'
import { computeKRWQuotation } from '@/lib/price-utils'
import {
  computeStickyDisplayQuotationTotal,
  getStickyDisplayPerPaxKrw,
} from '@/lib/public-sticky-pax-display'
import { buildPriceDisplaySsot } from '@/lib/price-display-ssot'
import {
  buildDepartureViewModels,
  earliestBookableDeparture,
  formatDeparturePrice,
  globalLowestBookable,
} from '@/lib/departure-price-view-model'
import {
  ComparePriceRow,
  CurrentPriceRow,
  HERO_DATE_LABEL_CLASS,
  HERO_DATE_VALUE_CLASS,
} from '@/app/components/detail/product-detail-visual'
import {
  CARD_INSTALLMENT_DISCLAIMER,
  CARD_INSTALLMENT_SUMMARY,
  formatHeroDepartureSavingsLine,
  PRICE_MAIN_AMOUNT_HINT,
} from '@/lib/promotion-copy-normalize'
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
import {
  buildStickyPaxRows,
  getStickyLocalJoinAuxiliaryLine,
} from '@/lib/public-sticky-quote-display'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function toDateKey(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

/** 인원 카드 공통: − / + 동일 크기·테두리·호버 (모든 슬롯에서 재사용) */
const PAX_STEP_BUTTON_CLASS =
  'inline-flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-lg border border-bt-border-strong bg-bt-surface text-lg font-semibold leading-none text-bt-title shadow-sm transition-colors hover:bg-bt-surface-alt active:bg-bt-surface-soft disabled:pointer-events-none disabled:opacity-40 disabled:hover:bg-bt-surface'

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
}

export default function ProductLiveQuoteCard({
  product,
  prices,
  selectedDate,
  pax,
  updatePax,
  highRiskAlerts,
  onBookingOpen,
  onOpenDeparturePicker,
  variant = 'desktop',
  fromScreen,
  departureConditionLine,
  heroTripDepartureDisplay,
  heroTripReturnDisplay,
  modetourStickyLocalPayLine,
  updateChildCombined,
  explicitPriceRow,
  isCollectingPrices = false,
  priceCollectUiPhase = 'idle',
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

  /** 상담 요약 참고용 — API `pricingMode` 와 동일 문자열로 맞춤 */
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
  const selectedDepartureCurrentPrice = useMemo(() => {
    if (!priceRow) return null
    return computeKRWQuotation(priceRow, { adult: 1, childBed: 0, childNoBed: 0, infant: 0 }).total
  }, [priceRow])
  const priceSsot = useMemo(
    () => buildPriceDisplaySsot(selectedDepartureCurrentPrice, product.pricePromotionView),
    [selectedDepartureCurrentPrice, product.pricePromotionView]
  )

  const localFeePerPerson = product.mandatoryLocalFee ?? null
  const hasOptionalOptions = useMemo(() => {
    if (product.hasOptionalTours === true) return true
    const structured = (product.optionalToursStructured ?? '').trim()
    const legacy = (product.optionalTours ?? []).length > 0
    const notice = Boolean(product.optionalTourNoticeRaw?.trim()) || (product.optionalTourNoticeItems?.length ?? 0) > 0
    return Boolean(structured) || legacy || notice
  }, [product.hasOptionalTours, product.optionalToursStructured, product.optionalTours, product.optionalTourNoticeRaw, product.optionalTourNoticeItems])
  const shareSummary = `${product.originCode} · ${product.destination} · ${product.duration}${product.airline ? ` · ${product.airline}` : ''} · 출발 ${selectedDate ?? '미선택'} · ${priceSsot.selectedDeparturePrice != null ? `₩${priceSsot.selectedDeparturePrice.toLocaleString('ko-KR')}` : '상담 시 안내'}`

  const viewModels = useMemo(() => buildDepartureViewModels(prices, product.originSource), [prices, product.originSource])

  const globalLow = useMemo(() => globalLowestBookable(viewModels), [viewModels])
  const earliest = useMemo(() => earliestBookableDeparture(viewModels), [viewModels])

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
  const isHanatourProduct = normalizeSupplierOrigin(product.originSource) === 'hanatour'

  const stickyPaxRows = useMemo(
    () => buildStickyPaxRows(product.originSource, priceRow),
    [product.originSource, priceRow]
  )

  const localJoinAuxLine = useMemo(
    () =>
      getStickyLocalJoinAuxiliaryLine({
        originSource: product.originSource,
        excludedText: product.excludedText,
        priceTableRawText: product.priceTableRawText ?? null,
      }),
    [product.originSource, product.excludedText, product.priceTableRawText]
  )

  const showCollectingBanner =
    isCollectingPrices &&
    (priceCollectUiPhase === 'collecting' || priceCollectUiPhase === 'delayed_collecting')
  const showPendingQuoteBanner = !isCollectingPrices && priceCollectUiPhase === 'pending_quote'

  return (
    <div className={`bt-card-strong border-2 border-bt-border-soft ${pad}`}>
      <h2 className="mb-1 border-l-4 border-bt-card-title pl-3 text-base font-black tracking-tight text-bt-card-title">
        실시간 견적
      </h2>
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
      <div className="mt-3 rounded-xl border border-bt-border-soft bg-bt-surface-soft px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-bt-muted">선택 일정</p>
        <div className="mt-2 space-y-1">
          <p className="flex items-baseline justify-between gap-2 text-sm">
            <span className={HERO_DATE_LABEL_CLASS}>출발일</span>
            <span className={HERO_DATE_VALUE_CLASS}>
              {heroTripDepartureDisplay ??
                (selectedDate
                  ? `${selectedDate} (${WEEKDAY[new Date(`${selectedDate}T12:00:00`).getDay()]})`
                  : '미선택')}
            </span>
          </p>
          {selectedDate ? (
            <p className="text-center text-[11px] font-semibold text-bt-card-accent-strong">
              일정 상태: {departureAdvisoryLabel}
            </p>
          ) : null}
          <p className="flex items-baseline justify-between gap-2 text-sm">
            <span className={HERO_DATE_LABEL_CLASS}>귀국일</span>
            <span className={HERO_DATE_VALUE_CLASS}>
              {heroTripReturnDisplay ?? '상담 시 안내'}
            </span>
          </p>
        </div>
        {globalLow && earliest ? <p className="mt-1 text-[10px] text-bt-muted">참고 최저가 {formatDeparturePrice(globalLow)}</p> : null}
      </div>

      <div className="mt-3 rounded-xl border border-bt-border-soft bg-bt-surface-soft px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-bt-muted">가격</p>
        <div className="mt-2 flex flex-col gap-2">
          {priceSsot.couponDiscountAmount > 0 && priceSsot.displayPriceBeforeCoupon != null ? (
            <ComparePriceRow amount={priceSsot.displayPriceBeforeCoupon} />
          ) : null}
          <CurrentPriceRow amount={priceSsot.selectedDeparturePrice} size="xl" />
          {priceSsot.selectedDeparturePrice != null ? (
            <p className="text-[11px] text-bt-meta">{PRICE_MAIN_AMOUNT_HINT}</p>
          ) : null}
        </div>
        {priceSsot.couponDiscountAmount > 0 ? (
          <p className="mt-2 text-center text-sm font-semibold text-bt-card-accent-strong">
            {formatHeroDepartureSavingsLine(priceSsot.couponDiscountAmount)}
          </p>
        ) : null}
        {quotationTotal != null ? (
          <p className="mt-1.5 flex flex-wrap items-baseline gap-1 text-[11px] text-bt-muted">
            <span>선택 인원 견적 합계</span>
            <span className="inline-flex items-baseline gap-0.5 font-semibold tabular-nums text-bt-body">
              <span className="text-[0.85em]">₩</span>
              <span>{quotationTotal.toLocaleString('ko-KR')}</span>
            </span>
          </p>
        ) : null}
        {localJoinAuxLine ? (
          <p className="mt-1 text-[11px] leading-snug text-bt-muted">{localJoinAuxLine}</p>
        ) : null}
      </div>

      {isHanatourProduct && highRiskAlerts.length > 0 ? (
        <div
          className="mt-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-center dark:border-amber-900/50 dark:bg-amber-950/35"
          role="note"
        >
          {highRiskAlerts.map((line, idx) => (
            <p
              key={idx}
              className="bt-wrap text-[11px] font-semibold leading-relaxed text-amber-950 dark:text-amber-100"
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <p className="mt-3 rounded-xl border border-bt-border-soft bg-bt-surface px-3 py-2 text-[11px] leading-relaxed text-bt-meta">
        <span className="font-semibold text-bt-card-title">{CARD_INSTALLMENT_SUMMARY}</span> · {CARD_INSTALLMENT_DISCLAIMER}
      </p>

      {departureConditionLine?.trim() ? (
        <p className="mt-3 text-center text-[11px] font-semibold leading-snug text-bt-card-accent-strong">
          {departureConditionLine.trim()}
        </p>
      ) : null}

      {prices.length > 0 ? (
      <button
          type="button"
          onClick={onOpenDeparturePicker}
        className="mt-3 w-full bt-btn-primary"
        >
          출발일 변경
        </button>
      ) : null}

      {modetourStickyLocalPayLine?.trim() ? (
        <p className="mt-2 text-center text-[11px] font-semibold leading-snug text-bt-body">
          {modetourStickyLocalPayLine.trim()}
        </p>
      ) : null}

      {!priceRow && selectedDate ? (
        <p className="mb-3 text-sm text-bt-meta">
          선택하신 출발일 기준으로 표시할 요금 행이 없습니다. 예약 요청 접수·카카오 상담은 가능하며, 금액·좌석은 확인 후 안내됩니다.
        </p>
      ) : null}
      {!priceRow && !selectedDate ? (
        <p className="mb-3 text-sm text-bt-disabled">출발일을 선택해 주세요.</p>
      ) : null}

      <div className="mt-4 border-t border-bt-border-soft pt-3">
        <p className="text-xs text-bt-meta">
          {isModetourProduct && modetourStickyLocalPayLine?.trim() ? (
            <>선택관광·현지 옵션은 부가 정보의 「현지옵션」 탭에서 확인해 주세요.</>
          ) : (
            <>
              현지옵션: {hasOptionalOptions ? '현지 선택' : '상담 시 안내'}
              {modetourStickyLocalPayLine?.trim()
                ? ''
                : localFeePerPerson != null &&
                    product.mandatoryCurrency &&
                    !(isHanatourProduct && highRiskAlerts.length > 0)
                  ? ` · 현지 지불 경비(인당) ${product.mandatoryCurrency} ${localFeePerPerson.toLocaleString()}`
                  : ''}
            </>
          )}
        </p>
      </div>

      <div className="mt-4 border-t border-bt-border-soft pt-4">
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
                    <div className="grid h-11 min-h-[2.75rem] w-full max-w-[11rem] grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateChildCombined(-1)}
                        disabled={atMin}
                        className={PAX_STEP_BUTTON_CLASS}
                        aria-label={`${label} 감소`}
                      >
                        −
                      </button>
                      <span className="text-center text-lg font-bold leading-none tabular-nums text-bt-title">{count}</span>
                      <button
                        type="button"
                        onClick={() => updateChildCombined(1)}
                        className={PAX_STEP_BUTTON_CLASS}
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
                  <div className="grid h-11 min-h-[2.75rem] w-full max-w-[11rem] grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updatePax(key, -1)}
                      disabled={atMin}
                      className={PAX_STEP_BUTTON_CLASS}
                      aria-label={`${label} 감소`}
                    >
                      −
                    </button>
                    <span className="text-center text-lg font-bold leading-none tabular-nums text-bt-title">{count}</span>
                    <button
                      type="button"
                      onClick={() => updatePax(key, 1)}
                      className={PAX_STEP_BUTTON_CLASS}
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
      {/* 하나투어: 가격 블록 아래 `highRiskAlerts`로 현지 의무 지불·상담 포인트 노출. 그 외 공급사는 푸터 한 줄만. */}
    </div>
  )
}
