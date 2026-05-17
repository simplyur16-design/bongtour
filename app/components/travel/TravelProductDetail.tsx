'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import ProductHighlightPointsSection from '@/app/components/detail/ProductHighlightPointsSection'
import { formatFlightLegTwoLines } from '@/lib/flight-user-display'
import ProductExtraInfoTabs from '@/app/components/detail/ProductExtraInfoTabs'
import { filterPublicMustKnowItemsForTripReadiness } from '@/lib/public-must-know-display'
import MustKnowEssentialsSection from '@/app/components/travel/MustKnowEssentialsSection'
import EsimProductDetailCrossSell from '@/app/components/travel/EsimProductDetailCrossSell'
import type { PublicPricePromotionView, ShoppingStopRow } from '@/lib/public-product-extras'
import {
  buildPublicOptionalDisplayInputFromProductFields,
  buildPublicShoppingDisplayInputFromProductFields,
} from '@/lib/public-product-extras'
import { isBannedOptionalTourName } from '@/lib/optional-tour-row-gate-hanatour'
import {
  getPublicOptionalTourRowsFromProduct,
  parseLegacyStructuredOptionalTours,
  toLegacyBookingTypeLabel,
} from '@/lib/optional-tours-ui-model'
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
import { buildModetourHeroHaystackFromProduct } from '@/lib/modetour-body-dates'
import { resolveHeroTripDates } from '@/lib/product-hero-dates'
import PackageProductHeroSection from '@/app/components/detail/PackageProductHeroSection'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SUBPAGE_PAGE_SHELL_CLASS } from '@/lib/subpage-design-system'
import ProductLiveQuoteCard from '@/app/components/detail/ProductLiveQuoteCard'
import DepartureDatePickerModal from '@/app/components/detail/DepartureDatePickerModal'
import { ItineraryViewPackageMain } from '@/components/itinerary/ItineraryViewPackageMain'
import DeparturePriceCollectOverlay from '@/app/components/detail/DeparturePriceCollectOverlay'
import BookingIntakeModal from '@/app/components/travel/BookingIntakeModal'
import { resolveDeparturePriceCollectUiPhase } from '@/lib/departure-price-collect-ui'
import { useDeparturePriceCollectPhase } from '@/lib/hooks/use-departure-price-collect-phase'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcHanatour } from '@/lib/flight-manual-correction-hanatour'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcModetour } from '@/lib/flight-manual-correction-modetour'
import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'
import type { FlightStructuredBody } from '@/lib/public-product-extras'
import { buildPriceDisplaySsot } from '@/lib/price-display-ssot'
import ScheduleDayHotelMealCard from '@/app/components/detail/ScheduleDayHotelMealCard'
import { HERO_DATE_INLINE_VALUE_CLASS } from '@/app/components/detail/product-detail-visual'
import { buildProductMetaChips } from '@/lib/product-meta-chips'
import { formatScheduleDayHotelLine, formatMealDisplay, getHotelMealLabels } from '@/lib/hotel-meal-display'
import {
  CARD_INSTALLMENT_DISCLAIMER,
  CARD_INSTALLMENT_SUMMARY,
  formatHeroDepartureSavingsLine,
  PRICE_MAIN_AMOUNT_HINT,
} from '@/lib/promotion-copy-normalize'
import type { DayHotelPlan } from '@/lib/day-hotel-plans-hanatour'
import { formatHeroDateKorean } from '@/lib/hero-date-utils'
import { computeReturnDate, getProductTotalDays } from '@/lib/package-rules'
import { formatDepartureConditionForProduct } from '@/lib/minimum-departure-extract'
import {
  buildHanatourDepartureEvidenceHaystack,
  formatHanatourDepartureConditionForProduct,
  hanatourShouldAppendDepartureStatusBlob,
} from '@/lib/hanatour-departure-flight-display'
import { applyHanatourFlightRoutingChipOverride } from '@/lib/hanatour-product-meta-chips-patch'
import { isScheduleUserPlaceholder, resolvePublicScheduleDayTitle } from '@/lib/public-schedule-display'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'
import { coverImageUrlForTravelProductClient } from '@/lib/travel-product-cover-url'

/** Prisma ProductPrice + quote price* fields (lib/price-utils PriceRowLike compatible) */
export type ProductPriceRow = {
  id: string
  productId: string
  date: string
  adult: number
  childBed: number | null
  childNoBed: number | null
  infant: number | null
  localPrice: string | null
  priceGap: number
  priceAdult: number
  priceChildWithBed: number | null
  priceChildNoBed: number | null
  priceInfant: number | null
  status?: string
  /** Calendar row remaining seats — optional hint on booking pax row */
  availableSeats?: number
  /** ProductDeparture.seatsStatusRaw — seat count vs separate booking/remaining copy */
  seatsStatusRaw?: string
}

export type ProductItinerary = { id: number; day: number; description: string }

export type CounselingPoint = {
  title: string
  content: string
  script: string
}

export type ScheduleDay = {
  day: number
  description: string
  imageUrl?: string | null
  imageDisplayName?: string | null
  title?: string
  imageKeyword?: string | null
  /** ItineraryDay.city — carousel DAY label fallback */
  city?: string | null
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
  /** Detail merge: ItineraryDay.meals when meal fields empty — one meal card line */
  meals?: string | null
}

export type TravelProduct = {
  id: number | string
  originSource: string
  originCode: string
  title: string
  destination: string
  duration: string
  airline: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  includedText: string | null
  excludedText: string | null
  counselingNotes?: { counseling_points: CounselingPoint[] } | null
  criticalExclusions?: string | null
  productType?: string | null
  airportTransferType?: string | null
  optionalToursStructured?: string | null
  prices: ProductPriceRow[]
  itineraries: ProductItinerary[]
  schedule?: ScheduleDay[] | null
  bgImageUrl?: string | null
  /** Hero image source type (Product.bgImageSource) — hero badge */
  bgImageSource?: string | null
  /** AI-generated flag (Product.bgImageIsGenerated) */
  bgImageIsGenerated?: boolean | null
  bgImagePhotographer?: string | null
  /** When no schedule display name — image_assets meta for hero caption */
  heroCoverCaptionFromAsset?: string | null
  /** Hero image left SEO keyword overlay (separate from caption) */
  heroImageSeoKeywordOverlay?: string | null
  optionalTours?: Array<{ id: string; name: string; priceUsd: number; duration: string; waitPlaceIfNotJoined: string }>
  shoppingCount?: number | null
  shoppingItems?: string | null
  optionalTourNoticeRaw?: string | null
  optionalTourNoticeItems?: string[]
  optionalTourDisplayNoticeFinal?: string | null
  /** structuredSignals.optionalToursPasteRaw — tab SSOT when structured rows empty */
  optionalToursPasteRaw?: string | null
  shoppingVisitCountTotal?: number | null
  shoppingNoticeRaw?: string | null
  /** structuredSignals.shoppingPasteRaw — tab SSOT when structured rows empty */
  shoppingPasteRaw?: string | null
  shoppingStopsStructured?: ShoppingStopRow[] | null
  freeTimeSummaryText?: string | null
  hasFreeTime?: boolean | null
  hasOptionalTours?: boolean | null
  pricePromotionView?: PublicPricePromotionView | null
  benefitSummary?: string | null
  /** D-5: highlight points for public display priority */
  highlightPoints?: string | null
  /** D-5: supplier-extracted highlight raw */
  highlightPointsRaw?: string | null
  promotionLabelsRaw?: string | null
  priceFrom?: number | null
  priceCurrency?: string | null
  /** Per-departure flight/meeting summary (YYYY-MM-DD) */
  departureKeyFactsByDate?: Record<string, DepartureKeyFacts>
  /** Per departure id — same calendar row execution/price SSOT */
  departureKeyFactsByDepartureId?: Record<string, DepartureKeyFacts>
  /** rawMeta flight body — enriches flight card when departure row empty */
  flightStructured?: FlightStructuredBody | null
  /** Body price table raw — age bracket extraction for pax card */
  priceTableRawText?: string | null
  hotelSummaryRaw?: string | null
  hotelSummaryText?: string | null
  hotelNames?: string[] | null
  /** Per-day planned hotels (structured + schedule + body parser merge on server) */
  dayHotelPlans?: DayHotelPlan[] | null
  hotelInfoRaw?: string | null
  hotelStatusText?: string | null
  hotelNoticeRaw?: string | null
  primaryRegion?: string | null
  primaryDestination?: string | null
  airtelHotelInfoJson?: string | null
  infantAgeRuleText?: string | null
  childAgeRuleText?: string | null
  reservationNoticeRaw?: string | null
  mustKnowItems?: Array<{ category: string; title: string; body: string; raw?: string }>
  /** rawMeta structured — single-room surcharge card merge */
  singleRoomSurchargeDisplayText?: string | null
  singleRoomSurchargeAmount?: number | null
  singleRoomSurchargeCurrency?: string | null
  minimumDepartureCount?: number | null
  minimumDepartureText?: string | null
  isDepartureGuaranteed?: boolean | null
  currentBookedCount?: number | null
  remainingSeatsCount?: number | null
  departureStatusText?: string | null
  meetingInfoRaw?: string | null
  meetingPlaceRaw?: string | null
  meetingFallbackText?: string | null
  flightExposurePolicy?: 'public_full' | 'public_limited' | 'admin_only' | null
  /** structuredSignals.flightManualCorrection — legacy_parsed display (flight no/time only) */
  flightManualCorrection?: FlightManualCorrectionPayload | null
  /** Apply manual flight correction when only parsed body flight is shown */
  applyFlightManualCorrectionOverlay?: boolean
  /** Modetour: local pay line below departure-change CTA */
  modetourStickyLocalPayLine?: string | null
  /** travel | private_trip | air_hotel_free — listing kind UI branch */
  listingKind?: string | null
  /** rawMeta structuredSignals.flightAdminJson — ItineraryExtraInfoBoxes 항공 SSOT */
  flightAdminJson?: string | null
}

function toDateKey(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

type Props = { product: TravelProduct; showEsimCrossSell?: boolean }

function applyFlightManualCorrectionForPublicOrigin(
  facts: DepartureKeyFacts | null,
  correction: FlightManualCorrectionPayload | null | undefined,
  originSource: string
): DepartureKeyFacts | null {
  const key = normalizeSupplierOrigin(originSource)
  const apply = key === 'modetour' ? applyFmcModetour : applyFmcHanatour
  return apply(facts, correction)
}

export default function TravelProductDetail({ product, showEsimCrossSell = false }: Props) {
  const router = useRouter()
  const [departureUserPinned, setDepartureUserPinned] = useState(false)
  const [selectedDepartureRowId, setSelectedDepartureRowId] = useState<string | null>(null)
  const [pax, setPax] = useState({ adult: 1, childBed: 0, childNoBed: 0, infant: 0 })
  const [bookingOpen, setBookingOpen] = useState(false)
  const [departurePickerOpen, setDeparturePickerOpen] = useState(false)
  const [pricePatches, setPricePatches] = useState<ProductPriceRow[]>([])
  const [onDemandNotice, setOnDemandNotice] = useState<string | null>(null)
  const [departureCollectOpen, setDepartureCollectOpen] = useState(false)
  /** Last calendar-picked YYYY-MM-DD — keep pinned date through remounts */
  const [calendarDateKey, setCalendarDateKey] = useState<string | null>(null)

  const mergedPrices = useMemo(() => {
    const by = new Map<string, ProductPriceRow>()
    for (const p of product.prices) {
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

  const structuredOptionalTours = useMemo(
    () => parseLegacyStructuredOptionalTours(product.optionalToursStructured),
    [product.optionalToursStructured]
  )
  const uiOptionalRows = useMemo(
    () => getPublicOptionalTourRowsFromProduct(product.optionalToursStructured, product.optionalToursPasteRaw),
    [product.optionalToursStructured, product.optionalToursPasteRaw]
  )
  const optionalToursForSheet = structuredOptionalTours.length
    ? structuredOptionalTours
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
    : (product.optionalTours ?? []).map((t) => ({
        ...t,
        bookingType: 'unknown' as const,
      }))
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

  const heroUrl = useMemo(() => coverImageUrlForTravelProductClient(product), [product.bgImageUrl, product.schedule])
  const daySlides = useMemo(
    () =>
      (product.schedule ?? []).map((d) => ({
        day: d.day,
        imageUrl: d.imageUrl,
        imageDisplayName: d.imageDisplayName,
        title: d.title ?? null,
        imageKeyword: d.imageKeyword ?? null,
        city: d.city ?? null,
      })),
    [product.schedule]
  )

  const detailScope = product.primaryRegion === '援?궡' ? 'domestic' : 'overseas'
  const labels = getHotelMealLabels(detailScope)

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

  const selectedPriceRow = useMemo(() => {
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
        Boolean(selectedDate?.trim() && !selectedPriceRow && !departureCollectOpen)
      ),
    [departureCollectOpen, collectUi.phase, selectedDate, selectedPriceRow]
  )

  const intakeDepartureAdvisory = useMemo(
    () => advisoryForDepartureRow(findPriceRowForDateKey(mergedPrices, selectedDate), departureCollectOpen),
    [mergedPrices, selectedDate, departureCollectOpen]
  )

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

  /** mustKnowItems filter — shared with travel/private/semi. Empty falls back to default trip-readiness items. */
  const mustKnowFiltered = useMemo(
    () =>
      filterPublicMustKnowItemsForTripReadiness(
        product.mustKnowItems ?? [],
        normalizeSupplierOrigin(product.originSource) === 'hanatour' ? 10 : 6,
        product.originSource
      ),
    [product.mustKnowItems, product.originSource]
  )

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

  const meetingDefault = useMemo(() => {
    const merged = [product.meetingInfoRaw?.trim(), product.meetingPlaceRaw?.trim()].filter(Boolean).join(' · ')
    if (merged.trim()) return merged.trim()
    const fb = product.meetingFallbackText?.trim()
    if (fb) return fb
    return '미팅장소는 상담 시 확인하여 안내드리겠습니다.'
  }, [product.meetingInfoRaw, product.meetingPlaceRaw, product.meetingFallbackText])

  const selectedDepartureCurrentPrice = selectedPriceRow
    ? computeKRWQuotation(selectedPriceRow, { adult: 1, childBed: 0, childNoBed: 0, infant: 0 }).total
    : null

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
        fallbackPriceRowDate: selectedPriceRow ? toDateKey(selectedPriceRow.date) : null,
        duration: product.duration,
        departureFacts: selectedDepartureFacts,
        modetourBodyHaystack,
      }),
    [
      product.originSource,
      selectedDate,
      selectedPriceRow,
      product.duration,
      selectedDepartureFacts,
      modetourBodyHaystack,
    ]
  )
  const heroDepartureDisplay =
    heroResolved.departureDisplayOverride ??
    (formatHeroDateKorean(heroResolved.departureIso) ?? heroResolved.departureIso ?? null)

  const packageTotalDays = getProductTotalDays(
    product,
    product.schedule?.length ? product.schedule.length : null
  )
  const departureDateFrom = mergedPrices[0] ? toDateKey(mergedPrices[0].date) : null
  const computedReturnDate = useMemo(() => {
    const dep =
      selectedDate ?? (selectedPriceRow ? toDateKey(selectedPriceRow.date) : departureDateFrom)
    return computeReturnDate(dep, packageTotalDays)
  }, [selectedDate, selectedPriceRow, departureDateFrom, packageTotalDays])

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
    const seats = selectedPriceRow?.availableSeats
    const bits: string[] = []
    if (base) bits.push(base)
    if (seats != null && seats >= 0) bits.push(`여유좌석 약 ${seats}석`)
    if (normalizeSupplierOrigin(product.originSource) === 'hanatour') {
      const seatBlob = selectedPriceRow?.seatsStatusRaw?.trim() || selectedPriceRow?.status?.trim()
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
    selectedPriceRow?.availableSeats,
    selectedPriceRow?.seatsStatusRaw,
    selectedPriceRow?.status,
    product,
  ])

  const periodContent = useMemo(
    () => (
      <>
        <span className={HERO_DATE_INLINE_VALUE_CLASS}>{heroDepartureDisplay ?? '—'}</span>
        <span className="text-bt-disabled"> ~ </span>
        <span className={HERO_DATE_INLINE_VALUE_CLASS}>
          {computedReturnDate ? computedReturnDate : '상담 시 안내'}
        </span>
        {product.duration?.trim() ? (
          <>
            {' '}
            <span className="font-extrabold text-bt-card-accent-strong">{product.duration.trim()}</span>
          </>
        ) : null}
      </>
    ),
    [heroDepartureDisplay, computedReturnDate, product.duration]
  )
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

  return (
    <div className={SUBPAGE_PAGE_SHELL_CLASS}>
      <Header />
      <main>
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
            masterTotalDays: packageTotalDays > 0 ? packageTotalDays : null,
            selectedDepartureIso: selectedDate,
            departureDateFrom,
            heroPriceSsot,
            heroDiscountSavingsLine,
            heroBenefitWhenNoDiscount,
            heroCouponText,
            departureConditionLine,
            productMetaChips,
            listingKind: product.listingKind,
            airportTransferType: product.airportTransferType,
            outboundFlight: formatFlightLegTwoLines(selectedDepartureFacts?.outbound ?? null),
            inboundFlight: formatFlightLegTwoLines(selectedDepartureFacts?.inbound ?? null),
          }}
          onChangeDepartureDate={handleChangeDepartureDate}
          showChangeDepartureCta={mergedPrices.length > 0}
          modetourStickyLocalPayLine={product.modetourStickyLocalPayLine ?? null}
        />

        <div className={`${SITE_CONTENT_CLASS} bg-[#FAFAFC] pt-4 py-6 sm:py-8 lg:pt-8`}>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-bt-link hover:text-bt-link-hover hover:underline"
        >
          ← 상품 목록
        </Link>

        {onDemandNotice ? (
          <p className="mt-6 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950">
            {onDemandNotice}
          </p>
        ) : null}

        <div className="mt-6 lg:hidden">
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
            onOpenDeparturePicker={handleChangeDepartureDate}
            variant="mobile"
            fromScreen="product_detail_mobile"
            departureConditionLine={departureConditionLine}
            heroTripDepartureDisplay={heroDepartureDisplay}
            heroTripReturnDisplay={computedReturnDate}
            modetourStickyLocalPayLine={product.modetourStickyLocalPayLine ?? null}
            isCollectingPrices={departureCollectOpen}
            priceCollectUiPhase={priceCollectUiPhase}
            masterTotalDays={packageTotalDays > 0 ? packageTotalDays : null}
            departureDateFrom={departureDateFrom}
          />
        </div>

        <div className="mt-6 lg:grid lg:grid-cols-[1fr_300px] lg:gap-10 lg:items-start">
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

          <aside className="hidden lg:block lg:sticky lg:top-[100px] lg:self-start">
            <div className="max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
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
                onOpenDeparturePicker={handleChangeDepartureDate}
                variant="desktop"
                fromScreen="product_detail_desktop"
                departureConditionLine={departureConditionLine}
                heroTripDepartureDisplay={heroDepartureDisplay}
                heroTripReturnDisplay={computedReturnDate}
                modetourStickyLocalPayLine={product.modetourStickyLocalPayLine ?? null}
                isCollectingPrices={departureCollectOpen}
                priceCollectUiPhase={priceCollectUiPhase}
                masterTotalDays={packageTotalDays > 0 ? packageTotalDays : null}
                departureDateFrom={departureDateFrom}
              />
            </div>
          </aside>
        </div>

        <DepartureDatePickerModal
          open={departurePickerOpen}
          onClose={() => setDeparturePickerOpen(false)}
          prices={mergedPrices}
          originSource={product.originSource}
          selectedDate={selectedDate}
          selectedSourceRowId={selectedPriceRow?.id ?? null}
          onSelectDate={handleDepartureDateChosen}
          listFirst={false}
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
      </main>
    </div>
  )
}
