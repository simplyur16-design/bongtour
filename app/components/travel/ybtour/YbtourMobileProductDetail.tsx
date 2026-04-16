'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { TravelProduct, ProductPriceRow } from '@/app/components/travel/TravelProductDetail'
import type { PublicPersistedFlightStructuredDto } from '@/lib/public-flight-structured-sanitize'
import BookingIntakeModal from '@/app/components/travel/BookingIntakeModal'
import TravelCoreInfoSection from '@/app/components/detail/TravelCoreInfoSection'
import YbtourProductExtraInfoTabs from '@/app/components/travel/ybtour/YbtourProductExtraInfoTabs'
import { isBannedOptionalTourName } from '@/lib/optional-tour-row-gate-hanatour'
import { parseLegacyStructuredOptionalTours, toLegacyBookingTypeLabel } from '@/lib/optional-tours-ui-model'
import { getYbtourOptionalTourUiRows } from '@/lib/optional-tours-ui-ybtour'
import { buildProductMetaChips } from '@/lib/product-meta-chips'
import { computeKRWQuotation } from '@/lib/price-utils'
import {
  pickAnyRowForDateKey,
  pickBookableRowForDateKey,
  pickGloballyCheapestDepartureRowByAdultPrice,
} from '@/lib/public-default-departure-selection'
import {
  advisoryForDepartureRow,
  findPriceRowForDateKey,
  quotePriceRowStrictForSelectedDate,
  resolvePublicDetailDateKey,
} from '@/lib/booking-departure-ssot'
import { parseRangeOnDemandResponse, postRangeOnDemandDepartures } from '@/lib/departure-range-on-demand-client'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { buildYbtourTripDateDisplaysForSelectedRow } from '@/lib/ybtour/ybtour-selected-row-trip-display'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import ProductHeroCarousel from '@/app/components/detail/ProductHeroCarousel'
import DepartureDatePickerModal from '@/app/components/detail/DepartureDatePickerModal'
import ProductLiveQuoteCard from '@/app/components/detail/ProductLiveQuoteCard'
import DeparturePriceCollectOverlay from '@/app/components/detail/DeparturePriceCollectOverlay'
import { resolveDeparturePriceCollectUiPhase } from '@/lib/departure-price-collect-ui'
import { useDeparturePriceCollectPhase } from '@/lib/hooks/use-departure-price-collect-phase'
import { buildPriceDisplaySsot } from '@/lib/price-display-ssot'
import ScheduleDayHotelMealCard from '@/app/components/detail/ScheduleDayHotelMealCard'
import type { ScheduleDay } from '@/app/components/travel/TravelProductDetail'
import { formatScheduleDayHotelLine, formatMealDisplay, getHotelMealLabels } from '@/lib/hotel-meal-display'
import {
  CARD_INSTALLMENT_DISCLAIMER,
  CARD_INSTALLMENT_SUMMARY,
  formatHeroDepartureSavingsLine,
  PRICE_MAIN_AMOUNT_HINT,
} from '@/lib/promotion-copy-normalize'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcHanatour } from '@/lib/flight-manual-correction-hanatour'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcModetour } from '@/lib/flight-manual-correction-modetour'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcYbtour } from '@/lib/flight-manual-correction-ybtour'
import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'
import {
  ComparePriceRow,
  CurrentPriceRow,
  HERO_DATE_INLINE_VALUE_CLASS,
  HERO_DATE_LABEL_CLASS,
  HERO_DATE_VALUE_CLASS,
  ProductDetailTitle,
  ProductMetaChips,
} from '@/app/components/detail/product-detail-visual'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'
import { coverImageUrlForTravelProductClient } from '@/lib/travel-product-cover-url'
import { formatDepartureConditionForProduct } from '@/lib/minimum-departure-extract'
import {
  buildHanatourDepartureEvidenceHaystack,
  formatHanatourDepartureConditionForProduct,
  hanatourShouldAppendDepartureStatusBlob,
} from '@/lib/hanatour-departure-flight-display'
import { applyHanatourFlightRoutingChipOverride } from '@/lib/hanatour-product-meta-chips-patch'
import { filterPublicMustKnowItemsForTripReadiness } from '@/lib/public-must-know-display'
import MustKnowEssentialsSection from '@/app/components/travel/MustKnowEssentialsSection'
import { isScheduleUserPlaceholder, resolvePublicScheduleDayTitle } from '@/lib/public-schedule-display'
import {
  buildPublicOptionalDisplayInputFromProductFields,
  buildPublicShoppingDisplayInputFromProductFields,
} from '@/lib/public-product-extras'

type ScheduleDayWithMeta = TravelProduct['schedule'] extends (infer D)[] | null | undefined
  ? D & { title?: string; notice?: string }
  : never

type YbtourTravelProductDetailProps = TravelProduct & {
  ybtourFlightStructuredForHero?: PublicPersistedFlightStructuredDto | null
}

type Props = { product: YbtourTravelProductDetailProps }

function toDateKey(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

function applyFlightManualCorrectionForPublicOrigin(
  facts: DepartureKeyFacts | null,
  correction: FlightManualCorrectionPayload | null | undefined,
  originSource: string
): DepartureKeyFacts | null {
  const key = normalizeSupplierOrigin(originSource)
  const apply =
    key === 'modetour' ? applyFmcModetour : key === 'ybtour' ? applyFmcYbtour : applyFmcHanatour
  return apply(facts, correction)
}

export default function YbtourMobileProductDetail({ product }: Props) {
  const router = useRouter()
  const schedule = product.schedule && product.schedule.length > 0 ? (product.schedule as ScheduleDayWithMeta[]) : []
  const heroUrl = useMemo(() => coverImageUrlForTravelProductClient({ ...product, schedule }), [product, schedule])
  const daySlides = schedule.map((d) => ({
    day: d.day,
    imageUrl: d.imageUrl,
    imageDisplayName: d.imageDisplayName,
    title: d.title ?? null,
    imageKeyword: d.imageKeyword ?? null,
    city: d.city ?? null,
  }))
  const detailScope = product.primaryRegion === '국내' ? 'domestic' : 'overseas'
  const labels = getHotelMealLabels(detailScope)
  const uiOptionalRows = useMemo(
    () => getYbtourOptionalTourUiRows(product.optionalToursStructured, product.optionalToursPasteRaw),
    [product.optionalToursStructured, product.optionalToursPasteRaw]
  )
  const structuredLegacy = useMemo(
    () => parseLegacyStructuredOptionalTours(product.optionalToursStructured),
    [product.optionalToursStructured]
  )
  const optionalToursMerged = useMemo(() => {
    if (structuredLegacy.length > 0) {
      return structuredLegacy
        .filter((t) => !isBannedOptionalTourName(t.name))
        .map((t, idx) => ({
          id: t.id ?? `s-${idx}`,
          name: t.name,
          priceUsd: t.priceValue ?? 0,
          duration: (t.description && t.description.trim()) || (t.rawText && t.rawText.trim()) || '',
          waitPlaceIfNotJoined: t.rawText ?? '',
          priceText: t.priceText,
          bookingType: toLegacyBookingTypeLabel(t.bookingType),
        }))
    }
    return (product.optionalTours ?? []).map((t) => ({ ...t, bookingType: 'unknown' as const }))
  }, [structuredLegacy, product.optionalTours])
  const optionalDisplayInput = useMemo(
    () =>
      buildPublicOptionalDisplayInputFromProductFields({
        optionalToursStructured: product.optionalToursStructured,
        optionalTourNoticeItems: product.optionalTourNoticeItems,
        optionalTourNoticeRaw: product.optionalTourNoticeRaw,
        optionalTourDisplayNoticeFinal: product.optionalTourDisplayNoticeFinal,
        optionalToursPasteRaw: product.optionalToursPasteRaw,
        optionalTours: product.optionalTours,
      }),
    [
      product.optionalToursStructured,
      product.optionalTourNoticeItems,
      product.optionalTourNoticeRaw,
      product.optionalTourDisplayNoticeFinal,
      product.optionalToursPasteRaw,
      product.optionalTours,
    ]
  )
  const shoppingDisplayInput = useMemo(
    () =>
      buildPublicShoppingDisplayInputFromProductFields({
        shoppingStopsStructured: product.shoppingStopsStructured,
        shoppingVisitCountTotal: product.shoppingVisitCountTotal,
        shoppingCount: product.shoppingCount,
        shoppingItems: product.shoppingItems,
        shoppingNoticeRaw: product.shoppingNoticeRaw,
        shoppingPasteRaw: product.shoppingPasteRaw,
      }),
    [
      product.shoppingStopsStructured,
      product.shoppingVisitCountTotal,
      product.shoppingCount,
      product.shoppingItems,
      product.shoppingNoticeRaw,
      product.shoppingPasteRaw,
    ]
  )
  const [departureUserPinned, setDepartureUserPinned] = useState(false)
  const [selectedDepartureRowId, setSelectedDepartureRowId] = useState<string | null>(null)
  const [pax, setPax] = useState({ adult: 1, childBed: 0, childNoBed: 0, infant: 0 })
  const [bookingOpen, setBookingOpen] = useState(false)
  const [departurePickerOpen, setDeparturePickerOpen] = useState(false)
  const [pricePatches, setPricePatches] = useState<ProductPriceRow[]>([])
  const [onDemandNotice, setOnDemandNotice] = useState<string | null>(null)
  const [departureCollectOpen, setDepartureCollectOpen] = useState(false)
  const [calendarDateKey, setCalendarDateKey] = useState<string | null>(null)

  const mergedPrices = useMemo(() => {
    const by = new Map<string, ProductPriceRow>()
    for (const p of Array.isArray(product.prices) ? product.prices : []) {
      by.set(toDateKey(p.date), p)
    }
    for (const p of pricePatches) {
      by.set(toDateKey(p.date), p)
    }
    return [...by.values()].sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)))
  }, [product.prices, pricePatches])

  useEffect(() => {
    setDepartureUserPinned(false)
    setPricePatches([])
    setOnDemandNotice(null)
    setDepartureCollectOpen(false)
    setCalendarDateKey(null)
  }, [String(product.id)])

  const defaultDepartureRow = useMemo(
    () => pickGloballyCheapestDepartureRowByAdultPrice(mergedPrices),
    [mergedPrices]
  )

  useEffect(() => {
    if (departureUserPinned) return
    if (!defaultDepartureRow) {
      setSelectedDepartureRowId(null)
      return
    }
    setSelectedDepartureRowId(defaultDepartureRow.id)
  }, [departureUserPinned, defaultDepartureRow?.id])

  useEffect(() => {
    if (!selectedDepartureRowId) return
    const row = mergedPrices.find((p) => p.id === selectedDepartureRowId)
    if (!row) {
      setDepartureUserPinned(false)
      setSelectedDepartureRowId(null)
    }
  }, [mergedPrices, selectedDepartureRowId])

  const runRangeOnDemandCollect = useCallback(
    async (isoDate: string) => {
      setDepartureCollectOpen(true)
      setOnDemandNotice(null)
      try {
        const { ok, data } = await postRangeOnDemandDepartures(String(product.id), isoDate, 14)
        if (!ok) {
          setOnDemandNotice('출발일 정보를 불러오는 중 문제가 발생했습니다. 다시 시도해 주세요.')
          return
        }
        const parsed = parseRangeOnDemandResponse(String(product.id), isoDate, data)
        if (parsed.kind === 'open_row') {
          setPricePatches((prev) => [...prev.filter((p) => toDateKey(p.date) !== isoDate), parsed.row])
          setSelectedDepartureRowId(parsed.row.id)
          setDepartureUserPinned(true)
          if (parsed.refreshRouter) router.refresh()
          return
        }
        if (parsed.kind === 'closed_row') {
          setPricePatches((prev) => [...prev.filter((p) => toDateKey(p.date) !== isoDate), parsed.row])
          setSelectedDepartureRowId(parsed.row.id)
          setDepartureUserPinned(true)
          setOnDemandNotice(parsed.notice)
          if (parsed.refreshRouter) router.refresh()
          return
        }
        if (parsed.kind === 'departure_not_found') {
          setOnDemandNotice('선택하신 날짜에는 출발 가능한 상품이 없습니다.')
          if (parsed.refreshRouter) router.refresh()
          return
        }
        if (parsed.kind === 'price_unavailable') {
          setOnDemandNotice('해당 날짜 출발은 있으나 가격을 아직 확인하지 못했습니다.')
          return
        }
        setOnDemandNotice('출발일 정보를 불러오는 중 문제가 발생했습니다. 다시 시도해 주세요.')
      } catch {
        setOnDemandNotice('출발일 정보를 불러오는 중 문제가 발생했습니다. 다시 시도해 주세요.')
      } finally {
        setDepartureCollectOpen(false)
      }
    },
    [product.id, router]
  )

  const handleYbtourDeparturePick = useCallback(
    async (dateIso: string, sourceRowId: string | null) => {
      if (departureCollectOpen) return
      setCalendarDateKey(dateIso)
      setOnDemandNotice(null)
      if (sourceRowId && mergedPrices.some((p) => p.id === sourceRowId)) {
        setSelectedDepartureRowId(sourceRowId)
        setDepartureUserPinned(true)
        return
      }
      const picked = pickBookableRowForDateKey(mergedPrices, dateIso)
      if (picked) {
        setSelectedDepartureRowId(picked.id)
        setDepartureUserPinned(true)
        return
      }
      const anyP = pickAnyRowForDateKey(mergedPrices, dateIso)
      if (anyP) {
        setSelectedDepartureRowId(anyP.id)
        setDepartureUserPinned(true)
        return
      }
      await runRangeOnDemandCollect(dateIso)
    },
    [mergedPrices, departureCollectOpen, runRangeOnDemandCollect]
  )

  const openBookingIntake = useCallback(() => {
    const dk = resolvePublicDetailDateKey({
      calendarDateKey,
      selectedDepartureRowId,
      mergedPrices,
      defaultDepartureRow,
    })
    if (dk && !findPriceRowForDateKey(mergedPrices, dk) && !departureCollectOpen) {
      void runRangeOnDemandCollect(dk)
    }
    setBookingOpen(true)
  }, [
    calendarDateKey,
    selectedDepartureRowId,
    mergedPrices,
    defaultDepartureRow,
    departureCollectOpen,
    runRangeOnDemandCollect,
  ])

  const selectedDate = useMemo(
    () =>
      resolvePublicDetailDateKey({
        calendarDateKey,
        selectedDepartureRowId,
        mergedPrices,
        defaultDepartureRow,
      }),
    [calendarDateKey, selectedDepartureRowId, mergedPrices, defaultDepartureRow]
  )

  const priceRow = useMemo(() => {
    const explicit = selectedDepartureRowId
      ? (mergedPrices.find((p) => p.id === selectedDepartureRowId) ?? null)
      : null
    return quotePriceRowStrictForSelectedDate(mergedPrices, selectedDate, explicit)
  }, [mergedPrices, selectedDate, selectedDepartureRowId])

  const collectUi = useDeparturePriceCollectPhase(departureCollectOpen)
  const priceCollectUiPhase = useMemo(
    () =>
      resolveDeparturePriceCollectUiPhase(
        departureCollectOpen,
        collectUi.phase === 'delayed_collecting',
        Boolean(selectedDate?.trim() && !priceRow && !departureCollectOpen)
      ),
    [departureCollectOpen, collectUi.phase, selectedDate, priceRow]
  )

  const intakeDepartureAdvisory = useMemo(
    () => advisoryForDepartureRow(findPriceRowForDateKey(mergedPrices, selectedDate), departureCollectOpen),
    [mergedPrices, selectedDate, departureCollectOpen]
  )

  const updatePax = (key: keyof typeof pax, delta: number) => {
    setPax((prev) => {
      const next = { ...prev, [key]: Math.max(0, prev[key] + delta) }
      if (next.adult === 0 && next.childBed === 0 && next.childNoBed === 0) next.adult = 1
      return next
    })
  }

  const updateChildCombined = useCallback((delta: number) => {
    setPax((prev) => {
      if (delta > 0) {
        const next = { ...prev, childBed: prev.childBed + delta }
        if (next.adult === 0 && next.childBed === 0 && next.childNoBed === 0) next.adult = 1
        return next
      }
      const { childBed, childNoBed } = prev
      if (childBed > 0) {
        const next = { ...prev, childBed: Math.max(0, childBed + delta) }
        if (next.adult === 0 && next.childBed === 0 && next.childNoBed === 0) next.adult = 1
        return next
      }
      const next = { ...prev, childNoBed: Math.max(0, childNoBed + delta) }
      if (next.adult === 0 && next.childBed === 0 && next.childNoBed === 0) next.adult = 1
      return next
    })
  }, [])

  const highRiskAlerts = useMemo(() => {
    const lines: string[] = []
    if (product.mandatoryLocalFee != null && product.mandatoryCurrency) {
      lines.push(`현지에서 ${product.mandatoryCurrency} ${product.mandatoryLocalFee}(인당) 별도 지불이 필요한 상품입니다`)
    }
    const points = product.counselingNotes?.counseling_points ?? []
    points.forEach((p) => {
      if (p.title && !lines.some((l) => l.includes(p.title))) lines.push(p.title)
    })
    return lines
  }, [product.mandatoryLocalFee, product.mandatoryCurrency, product.counselingNotes])

  const selectedDepartureFacts = useMemo(() => {
    if (!selectedDate) return null
    const row = product.departureKeyFactsByDate?.[selectedDate] ?? null
    if (product.applyFlightManualCorrectionOverlay && product.flightManualCorrection) {
      return applyFlightManualCorrectionForPublicOrigin(row, product.flightManualCorrection, product.originSource)
    }
    return row
  }, [
    selectedDate,
    product.departureKeyFactsByDate,
    product.applyFlightManualCorrectionOverlay,
    product.flightManualCorrection,
    product.originSource,
  ])

  const productMetaChips = useMemo(() => {
    const base = buildProductMetaChips(product, { departureFactsOverride: selectedDepartureFacts })
    if (normalizeSupplierOrigin(product.originSource) !== 'hanatour') return base
    return applyHanatourFlightRoutingChipOverride(base, {
      title: product.title,
      duration: product.duration,
      includedText: product.includedText,
      excludedText: product.excludedText,
      flightStructured: product.flightStructured ?? null,
      departureKeyFactsByDate: product.departureKeyFactsByDate ?? null,
      departureFactsOverride: selectedDepartureFacts,
    })
  }, [product, selectedDepartureFacts])

  const departureConditionLine = useMemo(() => {
    if (normalizeSupplierOrigin(product.originSource) !== 'hanatour') {
      return formatDepartureConditionForProduct(product)
    }
    return formatHanatourDepartureConditionForProduct(product)
  }, [product])

  /** 꼭 알아야 할 사항: `mustKnowItems`만(공급사 공통). 비면 기본 안내 문구. */
  const mustKnowFiltered = useMemo(
    () =>
      filterPublicMustKnowItemsForTripReadiness(
        product.mustKnowItems ?? [],
        normalizeSupplierOrigin(product.originSource) === 'hanatour' ? 10 : 6,
        product.originSource
      ),
    [product.mustKnowItems, product.originSource]
  )

  const meetingDefault = useMemo(() => {
    const merged = [product.meetingInfoRaw?.trim(), product.meetingPlaceRaw?.trim()].filter(Boolean).join(' · ')
    if (merged.trim()) return merged.trim()
    const fb = product.meetingFallbackText?.trim()
    if (fb) return fb
    return '미팅장소는 상담 시 확인하여 안내드리겠습니다.'
  }, [product.meetingInfoRaw, product.meetingPlaceRaw, product.meetingFallbackText])
  const selectedDepartureCurrentPrice = priceRow
    ? computeKRWQuotation(priceRow, { adult: 1, childBed: 0, childNoBed: 0, infant: 0 }).total
    : null
  const heroPriceSsot = buildPriceDisplaySsot(selectedDepartureCurrentPrice, product.pricePromotionView)
  const heroDiscountSavingsLine =
    heroPriceSsot.couponDiscountAmount > 0
      ? formatHeroDepartureSavingsLine(heroPriceSsot.couponDiscountAmount)
      : null
  const heroBenefitWhenNoDiscount =
    heroPriceSsot.couponDiscountAmount === 0
      ? product.pricePromotionView?.savingsText?.trim() || product.benefitSummary?.trim() || null
      : null
  const heroCouponText =
    product.pricePromotionView?.couponText?.trim() ||
    product.pricePromotionView?.benefitTitle?.trim() ||
    null

  const { departureDisplay: heroDepartureDisplay, returnDisplay: heroReturnDisplay } = useMemo(
    () =>
      buildYbtourTripDateDisplaysForSelectedRow({
        calendarDep: priceRow ? toDateKey(priceRow.date) : null,
        facts: selectedDepartureFacts,
        duration: product.duration,
      }),
    [priceRow, selectedDepartureFacts, product.duration]
  )

  const travelCitiesLine = useMemo(() => {
    const raw = [product.primaryDestination, product.destination]
      .filter((x): x is string => Boolean(x?.trim()))
      .join(',')
    const parts = raw
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const uniq = [...new Set(parts)]
    return uniq.length ? uniq.join(', ') : (product.destination?.trim() || '—')
  }, [product.primaryDestination, product.destination])

  const reservationDisplayLine = useMemo(() => {
    const base = departureConditionLine?.trim() || ''
    const seats = priceRow?.availableSeats
    const bits: string[] = []
    if (base) bits.push(base)
    if (seats != null && seats >= 0) bits.push(`여유좌석 약 ${seats}석`)
    const rowStatus = priceRow?.status?.trim()
    if (rowStatus && !bits.some((b) => b.includes(rowStatus))) bits.push(rowStatus)
    if (normalizeSupplierOrigin(product.originSource) === 'hanatour') {
      const seatBlob = priceRow?.seatsStatusRaw?.trim() || priceRow?.status?.trim()
      const hay = buildHanatourDepartureEvidenceHaystack(product)
      if (
        seatBlob &&
        hanatourShouldAppendDepartureStatusBlob(seatBlob, hay) &&
        !bits.some((b) => b.includes(seatBlob))
      ) {
        bits.push(seatBlob)
      }
    }
    return bits.length ? bits.join(' · ') : null
  }, [
    departureConditionLine,
    priceRow?.availableSeats,
    priceRow?.seatsStatusRaw,
    priceRow?.status,
    product,
  ])

  const periodContent = useMemo(
    () => (
      <>
        <span className={HERO_DATE_INLINE_VALUE_CLASS}>{heroDepartureDisplay ?? '—'}</span>
        <span className="text-bt-disabled"> ~ </span>
        <span className={HERO_DATE_INLINE_VALUE_CLASS}>{heroReturnDisplay ?? '상담 시 안내'}</span>
        {product.duration?.trim() ? (
          <>
            {' '}
            <span className="font-extrabold text-bt-card-accent-strong">{product.duration.trim()}</span>
          </>
        ) : null}
      </>
    ),
    [heroDepartureDisplay, heroReturnDisplay, product.duration]
  )

  return (
    <div className="min-h-screen bg-bt-surface pb-40">
      <ProductHeroCarousel
        heroUrl={heroUrl}
        daySlides={daySlides}
        productTitle={product.title}
        className="rounded-none border-x-0 border-t-0"
        heroImageSourceType={product.bgImageSource ?? null}
        heroImageIsGenerated={product.bgImageIsGenerated ?? null}
        heroImageSeoKeywordOverlay={product.heroImageSeoKeywordOverlay ?? null}
        primaryDestination={product.primaryDestination ?? null}
        destination={product.destination ?? null}
      />

      <section className="border-b-8 border-bt-success bg-bt-title p-5 text-bt-inverse sm:p-6">
        <ProductDetailTitle title={product.title} tone="dark" />
        <p className="text-xs leading-relaxed text-bt-inverse/80 sm:text-sm">
          <span className="font-mono font-semibold">{product.originCode}</span>
          <span className="mx-1.5 opacity-60">·</span>
          <span>{product.destination}</span>
          <span className="mx-1.5 opacity-60">·</span>
          <span>{product.duration}</span>
          {selectedDepartureFacts?.airline?.trim() ? (
            <>
              <span className="mx-1.5 opacity-60">·</span>
              <span>{selectedDepartureFacts.airline.trim()}</span>
            </>
          ) : null}
        </p>
        <p className="mt-2 text-[11px] text-bt-inverse/65">
          데이터 출처: {formatOriginSourceForDisplay(product.originSource)}
        </p>
        {productMetaChips.length > 0 && (
          <div className="mt-2">
            <ProductMetaChips chips={productMetaChips} variant="dark" />
          </div>
        )}
        <div className="mt-3 space-y-1 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-[11px]">
          <p className="flex justify-between gap-2">
            <span className={HERO_DATE_LABEL_CLASS}>출발일</span>
            <span className={HERO_DATE_VALUE_CLASS}>
              {heroDepartureDisplay ?? '선택 가능 출발일 자동 선택'}
            </span>
          </p>
          <p className="flex justify-between gap-2">
            <span className={HERO_DATE_LABEL_CLASS}>귀국일</span>
            <span className={HERO_DATE_VALUE_CLASS}>
              {heroReturnDisplay ?? '상담 시 안내'}
            </span>
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-white/20 bg-white/10 p-3 text-bt-inverse">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-bt-inverse/80">가격</p>
          <div className="mt-2 flex flex-col gap-2">
            {heroPriceSsot.couponDiscountAmount > 0 && heroPriceSsot.displayPriceBeforeCoupon != null ? (
              <ComparePriceRow amount={heroPriceSsot.displayPriceBeforeCoupon} variant="inverse" />
            ) : null}
            <CurrentPriceRow amount={heroPriceSsot.selectedDeparturePrice} size="xl" variant="inverse" />
            {heroPriceSsot.selectedDeparturePrice != null ? (
              <p className="text-[11px] text-white/80">{PRICE_MAIN_AMOUNT_HINT}</p>
            ) : null}
          </div>
          {heroDiscountSavingsLine ? (
            <p className="bt-wrap mt-1.5 text-[11px] font-semibold text-teal-200">{heroDiscountSavingsLine}</p>
          ) : null}
          {heroBenefitWhenNoDiscount ? (
            <p className="bt-wrap mt-1.5 text-[11px] text-bt-inverse/75">{heroBenefitWhenNoDiscount}</p>
          ) : null}
          {heroCouponText ? <p className="bt-wrap mt-0.5 text-[11px] text-bt-inverse/60">{heroCouponText}</p> : null}
          <div className="mt-3 border-t border-white/20 pt-3">
            <p className="text-center text-[11px] font-bold text-bt-inverse">{CARD_INSTALLMENT_SUMMARY}</p>
            <p className="bt-wrap mt-1 text-center text-[10px] leading-relaxed text-bt-inverse/70">
              {CARD_INSTALLMENT_DISCLAIMER}
            </p>
          </div>
          {departureConditionLine?.trim() ? (
            <p className="bt-wrap mt-2 text-center text-[11px] font-semibold leading-snug text-teal-100/95">
              {departureConditionLine.trim()}
            </p>
          ) : null}
        </div>
        {isAirHotelFreeListingForUi(product.listingKind) && (
          <div className="mt-2">
            <span className="inline-flex rounded-full border border-bt-card-accent-border bg-bt-card-accent-soft px-2 py-0.5 text-[11px] font-semibold text-bt-card-title">
              {product.airportTransferType === 'BOTH'
                ? '픽업·샌딩 포함'
                : product.airportTransferType === 'PICKUP'
                  ? '공항 픽업 포함'
                  : product.airportTransferType === 'SENDING'
                    ? '공항 샌딩 포함'
                    : '공항 이동 불포함'}
            </span>
          </div>
        )}
      </section>

      <div className="p-4">
        {onDemandNotice ? (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950">
            {onDemandNotice}
          </p>
        ) : null}
        <ProductLiveQuoteCard
          product={product}
          prices={mergedPrices}
          selectedDate={selectedDate}
          explicitPriceRow={
            selectedDepartureRowId
              ? (mergedPrices.find((p) => p.id === selectedDepartureRowId) ?? null)
              : null
          }
          pax={pax}
          updatePax={updatePax}
          updateChildCombined={updateChildCombined}
          highRiskAlerts={highRiskAlerts}
          onBookingOpen={openBookingIntake}
          onOpenDeparturePicker={() => setDeparturePickerOpen(true)}
          variant="mobile"
          fromScreen="product_detail_mobile"
          departureConditionLine={departureConditionLine}
          heroTripDepartureDisplay={heroDepartureDisplay}
          heroTripReturnDisplay={heroReturnDisplay}
          modetourStickyLocalPayLine={product.modetourStickyLocalPayLine ?? null}
          isCollectingPrices={departureCollectOpen}
          priceCollectUiPhase={priceCollectUiPhase}
        />
      </div>

      <div className="border-b border-bt-border-soft p-4">
        <TravelCoreInfoSection
          facts={selectedDepartureFacts}
          productAirline={selectedDepartureFacts?.airline?.trim() ?? null}
          periodContent={periodContent}
          travelCitiesLine={travelCitiesLine}
          reservationLine={reservationDisplayLine}
          meetingDefault={meetingDefault}
          meetingExtra={null}
          metaChips={productMetaChips}
          omitBriefRows={departurePickerOpen}
          flightExposurePolicy={product.flightExposurePolicy ?? null}
        />
      </div>

      <section className="border-b border-bt-border-soft p-4">
        <h2 className="mb-3 text-base font-semibold text-bt-card-title">일정 요약</h2>
        {product.listingKind === 'air_hotel_free' ? (
          <p className="bt-wrap mb-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-center text-xs font-semibold text-amber-950">
            아래보시는 일정은 예시 일정입니다.
          </p>
        ) : null}
        {product.listingKind !== 'air_hotel_free' &&
        product.freeTimeSummaryText?.trim() &&
        !isScheduleUserPlaceholder(product.freeTimeSummaryText) ? (
          <p className="bt-wrap mb-4 rounded-xl border border-bt-card-accent-border bg-bt-card-accent-soft px-3 py-2.5 text-center text-xs font-medium text-bt-body">
            {product.freeTimeSummaryText.trim()}
          </p>
        ) : null}
        {schedule.length > 0 ? (
          <div className="space-y-5">
            {schedule.map((day) => {
              const rawTitle = 'title' in day && day.title ? String(day.title) : ''
              const sd = day as ScheduleDay
              const title = resolvePublicScheduleDayTitle(rawTitle, sd.description)
              const hotelLine = formatScheduleDayHotelLine({
                hotelNames: product.hotelNames ?? null,
                hotelSummaryText: product.hotelSummaryText ?? null,
                dayHotelText: sd.hotelText ?? null,
              })
              const mealLines = formatMealDisplay({
                breakfastText: sd.breakfastText,
                lunchText: sd.lunchText,
                dinnerText: sd.dinnerText,
                mealSummaryText: sd.mealSummaryText,
                mealsLegacy: sd.meals ?? null,
              })
              return (
                <div key={day.day} className="border-b border-bt-border-soft pb-5 last:border-0 last:pb-0">
                  <p className="text-[11px] font-bold tracking-widest text-bt-card-accent-strong">
                    DAY {String(day.day).padStart(2, '0')}
                  </p>
                  {title ? <h3 className="mt-0.5 text-sm font-bold text-bt-card-title">{title}</h3> : null}
                  {(() => {
                    const scheduleBody = String(sd.description ?? '')
                      .replace(/\r/g, '\n')
                      .trim()
                    if (!scheduleBody || isScheduleUserPlaceholder(scheduleBody)) return null
                    return (
                      <p className="mt-1 whitespace-pre-wrap text-sm font-normal leading-relaxed text-bt-body">
                        {scheduleBody}
                      </p>
                    )
                  })()}
                  <ScheduleDayHotelMealCard hotelLine={hotelLine} mealLines={mealLines} labels={labels} />
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-bt-meta">등록된 일정 요약이 없습니다.</p>
        )}
      </section>

      <div className="border-b border-bt-border-soft p-4">
        <YbtourProductExtraInfoTabs
          key={String(product.id)}
          product={product}
          uiOptionalRows={uiOptionalRows}
          optionalDisplayInput={optionalDisplayInput}
          shoppingDisplayInput={shoppingDisplayInput}
          optionalToursForSheet={optionalToursMerged}
          shoppingCount={product.shoppingCount ?? 0}
          shoppingItems={product.shoppingItems ?? null}
          shoppingVisitCountTotal={product.shoppingVisitCountTotal ?? null}
          shoppingNoticeRaw={product.shoppingNoticeRaw ?? null}
          shoppingStopsStructured={product.shoppingStopsStructured ?? null}
        />
      </div>

      <MustKnowEssentialsSection items={mustKnowFiltered} layout="mobile" originSource={product.originSource} />

      <section className="p-4 pb-10 text-center">
        <h2 className="text-base font-semibold text-bt-card-title">안내</h2>
        <p className="bt-wrap mt-2 text-sm font-medium leading-relaxed text-bt-muted">
          문의·접수는 상단 <strong className="font-semibold text-bt-card-title">실시간 견적</strong> 카드에서 진행해 주세요. 본문은 정보 확인용입니다.
        </p>
      </section>

      <DepartureDatePickerModal
        open={departurePickerOpen}
        onClose={() => setDeparturePickerOpen(false)}
        prices={mergedPrices}
        originSource={product.originSource}
        selectedDate={selectedDate}
        selectedSourceRowId={priceRow?.id ?? null}
        onSelectDate={(iso) => {
          void handleYbtourDeparturePick(iso, null)
        }}
        onSelectDeparture={({ dateIso, sourceRowId }) => {
          void handleYbtourDeparturePick(dateIso, sourceRowId)
        }}
        filterDepartureListByCalendarMonth
        listFirst
        allowUndepartedCalendarPick
      />

      <BookingIntakeModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        productId={String(product.id)}
        productTitle={product.title}
        originSource={product.originSource}
        originCode={product.originCode}
        selectedDateFromCalendar={selectedDate}
        departureRowId={selectedDepartureRowId}
        departureAdvisoryLabel={intakeDepartureAdvisory}
        pax={pax}
        hasPriceSchedule={mergedPrices.length > 0}
        isCollectingPrices={departureCollectOpen}
        priceCollectUiPhase={priceCollectUiPhase}
      />

      {departureCollectOpen && !bookingOpen && collectUi.phase !== 'idle' ? (
        <DeparturePriceCollectOverlay
          phase={collectUi.phase === 'delayed_collecting' ? 'delayed_collecting' : 'collecting'}
          onContinueBooking={() => setBookingOpen(true)}
        />
      ) : null}
    </div>
  )
}
