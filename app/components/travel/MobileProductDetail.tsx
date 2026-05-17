'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductPriceRow, TravelProduct } from './TravelProductDetail'
import BookingIntakeModal from '@/app/components/travel/BookingIntakeModal'
import { formatDirectedFlightBodyLine } from '@/lib/flight-user-display'
import ProductHighlightPointsSection from '@/app/components/detail/ProductHighlightPointsSection'
import ProductExtraInfoTabs from '@/app/components/detail/ProductExtraInfoTabs'
import { isBannedOptionalTourName } from '@/lib/optional-tour-row-gate-hanatour'
import {
  getPublicOptionalTourRowsFromProduct,
  parseLegacyStructuredOptionalTours,
  toLegacyBookingTypeLabel,
} from '@/lib/optional-tours-ui-model'
import { buildProductMetaChips } from '@/lib/product-meta-chips'
import { formatKRW, computeKRWQuotation } from '@/lib/price-utils'
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
import { buildModetourHeroHaystackFromProduct } from '@/lib/modetour-body-dates'
import { resolveHeroTripDates } from '@/lib/product-hero-dates'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import PackageProductHeroSection from '@/app/components/detail/PackageProductHeroSection'
import { ItineraryViewPackageMain } from '@/components/itinerary/ItineraryViewPackageMain'
import DepartureDatePickerModal from '@/app/components/detail/DepartureDatePickerModal'
import DeparturePriceCollectOverlay from '@/app/components/detail/DeparturePriceCollectOverlay'
import { resolveDeparturePriceCollectUiPhase } from '@/lib/departure-price-collect-ui'
import { useDeparturePriceCollectPhase } from '@/lib/hooks/use-departure-price-collect-phase'
import { buildPriceDisplaySsot } from '@/lib/price-display-ssot'
import ScheduleDayHotelMealCard from '@/app/components/detail/ScheduleDayHotelMealCard'
import type { ScheduleDay } from './TravelProductDetail'
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
import { formatDepartureConditionForProduct } from '@/lib/minimum-departure-extract'
import {
  buildHanatourDepartureEvidenceHaystack,
  formatHanatourDepartureConditionForProduct,
  hanatourShouldAppendDepartureStatusBlob,
} from '@/lib/hanatour-departure-flight-display'
import { applyHanatourFlightRoutingChipOverride } from '@/lib/hanatour-product-meta-chips-patch'
import { filterPublicMustKnowItemsForTripReadiness } from '@/lib/public-must-know-display'
import MustKnowEssentialsSection from '@/app/components/travel/MustKnowEssentialsSection'
import EsimProductDetailCrossSell from '@/app/components/travel/EsimProductDetailCrossSell'
import { formatHeroDateKorean } from '@/lib/hero-date-utils'
import { isScheduleUserPlaceholder, resolvePublicScheduleDayTitle } from '@/lib/public-schedule-display'
import {
  buildPublicOptionalDisplayInputFromProductFields,
  buildPublicShoppingDisplayInputFromProductFields,
} from '@/lib/public-product-extras'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'
import { coverImageUrlForTravelProductClient } from '@/lib/travel-product-cover-url'

type ScheduleDayWithMeta = TravelProduct['schedule'] extends (infer D)[] | null | undefined
  ? D & { title?: string; notice?: string }
  : never

type Props = { product: TravelProduct; showEsimCrossSell?: boolean }

function toDateKey(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

function applyFlightManualCorrectionForPublicOrigin(
  facts: DepartureKeyFacts | null,
  correction: FlightManualCorrectionPayload | null | undefined,
  originSource: string
): DepartureKeyFacts | null {
  const key = normalizeSupplierOrigin(originSource)
  const apply = key === 'modetour' ? applyFmcModetour : applyFmcHanatour
  return apply(facts, correction)
}

export default function MobileProductDetail({ product, showEsimCrossSell = false }: Props) {
  const router = useRouter()
  const basePrices = Array.isArray(product.prices) ? product.prices : []
  const [pricePatches, setPricePatches] = useState<ProductPriceRow[]>([])
  const [onDemandNotice, setOnDemandNotice] = useState<string | null>(null)
  const [departureCollectOpen, setDepartureCollectOpen] = useState(false)
  const [calendarDateKey, setCalendarDateKey] = useState<string | null>(null)
  const mergedPrices = useMemo(() => {
    const by = new Map<string, ProductPriceRow>()
    for (const p of basePrices) {
      by.set(toDateKey(p.date), p)
    }
    for (const p of pricePatches) {
      by.set(toDateKey(p.date), p)
    }
    return [...by.values()].sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)))
  }, [basePrices, pricePatches])
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
    () => getPublicOptionalTourRowsFromProduct(product.optionalToursStructured, product.optionalToursPasteRaw),
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

  const handleDepartureDateChosen = useCallback(
    async (isoDate: string) => {
      if (departureCollectOpen) return
      setCalendarDateKey(isoDate)
      setOnDemandNotice(null)
      const picked = pickBookableRowForDateKey(mergedPrices, isoDate)
      if (picked) {
        setSelectedDepartureRowId(picked.id)
        setDepartureUserPinned(true)
        return
      }
      const anyP = pickAnyRowForDateKey(mergedPrices, isoDate)
      if (anyP) {
        setSelectedDepartureRowId(anyP.id)
        setDepartureUserPinned(true)
        return
      }
      await runRangeOnDemandCollect(isoDate)
    },
    [mergedPrices, departureCollectOpen, runRangeOnDemandCollect]
  )

  const handleChangeDepartureDate = useCallback(() => {
    setDeparturePickerOpen(true)
  }, [])

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

  const modetourBodyHaystack = useMemo(() => {
    if (normalizeSupplierOrigin(product.originSource) !== 'modetour') return null
    return buildModetourHeroHaystackFromProduct(product)
  }, [
    product.originSource,
    product.title,
    product.includedText,
    product.excludedText,
    product.reservationNoticeRaw,
    product.hotelSummaryRaw,
    product.hotelSummaryText,
    product.benefitSummary,
    product.promotionLabelsRaw,
    product.criticalExclusions,
    product.priceTableRawText,
    product.schedule,
    product.flightStructured,
  ])

  const heroResolved = useMemo(
    () =>
      resolveHeroTripDates({
        originSource: product.originSource,
        selectedDate,
        fallbackPriceRowDate: priceRow ? toDateKey(priceRow.date) : null,
        duration: product.duration,
        departureFacts: selectedDepartureFacts,
        modetourBodyHaystack,
      }),
    [
      product.originSource,
      selectedDate,
      priceRow,
      product.duration,
      selectedDepartureFacts,
      modetourBodyHaystack,
    ]
  )
  const heroDepartureDisplay =
    heroResolved.departureDisplayOverride ??
    (formatHeroDateKorean(heroResolved.departureIso) ?? heroResolved.departureIso ?? null)
  const heroReturnDisplay =
    heroResolved.returnDisplayOverride ??
    (formatHeroDateKorean(heroResolved.returnIso) ?? heroResolved.returnIso ?? null)

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
    <div className="min-h-screen bg-bt-surface pb-8">
      <PackageProductHeroSection
        heroUrl={heroUrl}
        daySlides={daySlides}
        productTitle={product.title}
        heroImageSourceType={product.bgImageSource ?? null}
        heroImagePhotographer={product.bgImagePhotographer ?? null}
        heroImageIsGenerated={product.bgImageIsGenerated ?? null}
        heroImageSeoKeywordOverlay={product.heroImageSeoKeywordOverlay ?? null}
        primaryDestination={product.primaryDestination ?? null}
        destination={product.destination ?? null}
        infoPanel={{
          dataSourceLabel: formatOriginSourceForDisplay(product.originSource),
          title: product.title,
          originCode: product.originCode,
          destination: product.destination,
          durationLabel: product.duration ?? '',
          airline: product.airline,
          heroDepartureDisplay,
          duration: product.duration ?? '',
          heroPriceSsot,
          heroDiscountSavingsLine,
          heroBenefitWhenNoDiscount,
          heroCouponText,
          departureConditionLine,
          productMetaChips,
          listingKind: product.listingKind,
          airportTransferType: product.airportTransferType,
          outboundFlightLine: formatDirectedFlightBodyLine(selectedDepartureFacts?.outbound ?? null),
          inboundFlightLine: formatDirectedFlightBodyLine(selectedDepartureFacts?.inbound ?? null),
        }}
        onChangeDepartureDate={handleChangeDepartureDate}
        showChangeDepartureCta={mergedPrices.length > 0}
        modetourStickyLocalPayLine={product.modetourStickyLocalPayLine ?? null}
      />

      {onDemandNotice ? (
        <p className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950">
          {onDemandNotice}
        </p>
      ) : null}

      <div className="bg-[#FAFAFC] px-4 pb-8">
        <ItineraryViewPackageMain
          product={product}
          selectedDepartureFacts={selectedDepartureFacts}
          periodContent={periodContent}
          travelCitiesLine={travelCitiesLine}
          reservationLine={reservationDisplayLine}
          meetingDefault={meetingDefault}
          productMetaChips={productMetaChips}
          omitBriefRows={departurePickerOpen}
          showEsimCrossSell={showEsimCrossSell}
        />
      </div>

      <DepartureDatePickerModal
        open={departurePickerOpen}
        onClose={() => setDeparturePickerOpen(false)}
        prices={mergedPrices}
        originSource={product.originSource}
        selectedDate={selectedDate}
        selectedSourceRowId={priceRow?.id ?? null}
        onSelectDate={handleDepartureDateChosen}
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
