'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import TravelCoreInfoSection from '@/app/components/detail/TravelCoreInfoSection'
import ProductHighlightPointsSection from '@/app/components/detail/ProductHighlightPointsSection'
import { formatFlightLegTwoLines } from '@/lib/flight-user-display'
import VerygoodProductExtraInfoTabs from '@/app/components/travel/verygood/VerygoodProductExtraInfoTabs'
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
} from '@/lib/public-default-departure-selection'
import {
  advisoryForDepartureRow,
  findPriceRowForDateKey,
  quotePriceRowStrictForSelectedDate,
  resolvePublicDetailDateKey,
} from '@/lib/booking-departure-ssot'
import { parseRangeOnDemandResponse, postRangeOnDemandDepartures } from '@/lib/departure-range-on-demand-client'
import { pickVerygoodPublicDefaultDepartureRow } from '@/lib/verygood/verygood-public-default-departure'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { formatPublicDestinationDisplayLabel } from '@/lib/bongtour-product-display-title-ssot'
import { buildVerygoodTripDateDisplaysForSelectedRow } from '@/lib/verygood/verygood-selected-row-trip-display'
import PackageProductHeroSection from '@/app/components/detail/PackageProductHeroSection'
import DepartureDatePickerModal from '@/app/components/detail/DepartureDatePickerModal'
import DeparturePriceCollectOverlay from '@/app/components/detail/DeparturePriceCollectOverlay'
import BookingIntakeModal from '@/app/components/travel/BookingIntakeModal'
import { resolveDeparturePriceCollectUiPhase } from '@/lib/departure-price-collect-ui'
import { useDeparturePriceCollectPhase } from '@/lib/hooks/use-departure-price-collect-phase'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { pickDepartureKeyFactsForSelection, type DepartureKeyFacts } from '@/lib/departure-key-facts'
import { alignDepartureKeyFactsToSelectedCalendarDate } from '@/lib/departure-facts-calendar-align'
import { getProductTotalDays } from '@/lib/package-rules'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcHanatour } from '@/lib/flight-manual-correction-hanatour'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcModetour } from '@/lib/flight-manual-correction-modetour'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcVerygood } from '@/lib/flight-manual-correction-verygoodtour'
import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'
import type { FlightStructuredBody } from '@/lib/public-product-extras'
import { buildPriceDisplaySsot } from '@/lib/price-display-ssot'
import ScheduleDayHotelMealCard from '@/app/components/detail/ScheduleDayHotelMealCard'
import {
  ComparePriceRow,
  CurrentPriceRow,
  HERO_DATE_INLINE_VALUE_CLASS,
  HERO_DATE_LABEL_CLASS,
  HERO_DATE_VALUE_CLASS,
  ProductDetailTitle,
  ProductMetaChips,
} from '@/app/components/detail/product-detail-visual'
import { buildProductMetaChips } from '@/lib/product-meta-chips'
import { formatMealDisplay, getHotelMealLabels } from '@/lib/hotel-meal-display'
import { computeVerygoodPublicDayHotelLine } from '@/lib/verygood-public-product-detail-patch'
import {
  CARD_INSTALLMENT_DISCLAIMER,
  CARD_INSTALLMENT_SUMMARY,
  formatHeroDepartureSavingsLine,
  PRICE_MAIN_AMOUNT_HINT,
} from '@/lib/promotion-copy-normalize'
import type { DayHotelPlan } from '@/lib/day-hotel-plans-hanatour'
import { formatDepartureConditionForProduct } from '@/lib/minimum-departure-extract'
import {
  buildHanatourDepartureEvidenceHaystack,
  formatHanatourDepartureConditionForProduct,
  hanatourShouldAppendDepartureStatusBlob,
} from '@/lib/hanatour-departure-flight-display'
import { applyHanatourFlightRoutingChipOverride } from '@/lib/hanatour-product-meta-chips-patch'
import { isScheduleUserPlaceholder, resolvePublicScheduleDayTitle } from '@/lib/public-schedule-display'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'
import TravelProductDetail from '@/app/components/travel/TravelProductDetail'
import type { TravelProduct as PackageTravelProduct } from '@/app/components/travel/TravelProductDetail'
import { coverImageUrlForTravelProductClient } from '@/lib/travel-product-cover-url'

/** Prisma ProductPrice + Í≤¨Ï†Å??price* (lib/price-utils PriceRowLike ?∏Ìôò) */
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
  /** ?¨Î†• ???îÏó¨???????àÏúºÎ©??àÏïΩ?∏Ïõê ?âÏóê Î≥¥Ï°∞ ?úÍ∏∞ */
  availableSeats?: number
  /** ProductDeparture.seatsStatusRaw ???´Ïûê Ï¢åÏÑùÍ≥?Î≥ÑÎèÑ???àÏïΩ/?îÏó¨ Î¨∏Íµ¨ */
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
  city?: string | null
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
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
  /** ?Ä???¥Î?ÏßÄ Ï∂úÏ≤ò ?Ä??Product.bgImageSource) ???àÏñ¥Î°?Î∞∞Ï? */
  bgImageSource?: string | null
  bgImagePhotographer?: string | null
  /** AI ?ùÏÑ± ?úÍ∏∞(Product.bgImageIsGenerated) */
  bgImageIsGenerated?: boolean | null
  /** ?ºÏ†ï ?úÏãúÎ™??ÜÏùÑ ??image_assets Î©îÌ?Î°??àÏñ¥Î°?Ï≤??¨Îùº?¥Îìú Ï∫°ÏÖò Î≥¥Í∞ï */
  heroCoverCaptionFromAsset?: string | null
  heroImageSeoKeywordOverlay?: string | null
  optionalTours?: Array<{ id: string; name: string; priceUsd: number; duration: string; waitPlaceIfNotJoined: string }>
  shoppingCount?: number | null
  shoppingItems?: string | null
  optionalTourNoticeRaw?: string | null
  optionalTourNoticeItems?: string[]
  optionalTourDisplayNoticeFinal?: string | null
  /** structuredSignals.optionalToursPasteRaw ??Íµ¨Ï°∞??0?????ÑÏ??µÏÖò ??SSOT ?êÎ¨∏ */
  optionalToursPasteRaw?: string | null
  shoppingVisitCountTotal?: number | null
  shoppingNoticeRaw?: string | null
  /** structuredSignals.shoppingPasteRaw ??Íµ¨Ï°∞??0?????ºÌïë ??SSOT ?êÎ¨∏ */
  shoppingPasteRaw?: string | null
  shoppingStopsStructured?: ShoppingStopRow[] | null
  freeTimeSummaryText?: string | null
  hasFreeTime?: boolean | null
  hasOptionalTours?: boolean | null
  pricePromotionView?: PublicPricePromotionView | null
  benefitSummary?: string | null
  highlightPoints?: string | null
  highlightPointsRaw?: string | null
  promotionLabelsRaw?: string | null
  priceFrom?: number | null
  priceCurrency?: string | null
  /** Ï∂úÎ∞ú?ºÎ≥Ñ ??≥µ¬∑ÎØ∏ÌåÖ ?îÏïΩ (YYYY-MM-DD) */
  departureKeyFactsByDate?: Record<string, DepartureKeyFacts>
  /** Ï∂úÎ∞ú ??idÎ≥?facts ???Ä??Í∞ÄÍ≤©ÌñâÍ≥?1:1 SSOT */
  departureKeyFactsByDepartureId?: Record<string, DepartureKeyFacts>
  /** rawMeta ??≥µ Î≥∏Î¨∏ ??Ï∂úÎ∞ú??ÎπÑÏñ¥ ?àÏùÑ ????≥µ Ïπ¥Îìú Î≥¥Í∞ï */
  flightStructured?: FlightStructuredBody | null
  /** Î≥∏Î¨∏ Í∞ÄÍ≤©Ìëú ?êÎ¨∏ ???∏Ïõê Ïπ¥Îìú ?∞Î†π Í∏∞Ï? Ï∂îÏ∂ú */
  priceTableRawText?: string | null
  hotelSummaryRaw?: string | null
  hotelSummaryText?: string | null
  hotelNames?: string[] | null
  /** ?ºÏ∞®Î≥??àÏ†ï?∏ÌÖî(?úÎ≤Ñ?êÏÑú structured¬∑?ºÏ†ï¬∑Î≥∏Î¨∏ ?åÏÑú Î≥ëÌï©) */
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
  /** rawMeta structured ??Î∂àÌè¨??Ïπ¥Îìú Î≥ëÌï©??*/
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
  /** structuredSignals.flightManualCorrection ??legacy_parsed ?úÏãú ???∏Î™Ö/?úÍ∞ÑÎß?*/
  flightManualCorrection?: FlightManualCorrectionPayload | null
  /** Î≥∏Î¨∏ ?åÏã± ??≥µÎß??∏Ï∂ú?????òÎèô Î≥¥Ï†ï ?ÅÏö© */
  applyFlightManualCorrectionOverlay?: boolean
  /** Î™®Îëê?¨Ïñ¥: Ï∂úÎ∞ú??Î≥ÄÍ≤?CTA Î∞îÎ°ú ?ÑÎûò ?ÑÏ? ÏßÄÎ∂àÍ≤ΩÎπ??∏Îãπ) ??Ï§?*/
  modetourStickyLocalPayLine?: string | null
  /** travel | private_trip | air_hotel_free ????≥µÍ∂??∏ÌÖî(?êÏú†?¨Ìñâ) UI Î∂ÑÍ∏∞ */
  listingKind?: string | null
  /** ?∏Ï≤ú¬∑ÍπÄ???úÏö∏Í∂???null ??Î∂Ä?∞¬∑Ï≤≠Ï£º¬∑Î?Íµ?∑Ï†úÏ£ºÎßå ?úÍ∏∞ */
  departureAirportLabelDisplay?: string | null
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
  const apply =
    key === 'modetour' ? applyFmcModetour : key === 'verygoodtour' ? applyFmcVerygood : applyFmcHanatour
  return apply(facts, correction)
}

function VerygoodTravelProductDetailView({ product, showEsimCrossSell = false }: Props) {
  const router = useRouter()
  const [departureUserPinned, setDepartureUserPinned] = useState(false)
  const [selectedDepartureRowId, setSelectedDepartureRowId] = useState<string | null>(() => {
    const row = pickVerygoodPublicDefaultDepartureRow(product.prices ?? [])
    return row?.id ?? null
  })
  const [pax, setPax] = useState({ adult: 1, childBed: 0, childNoBed: 0, infant: 0 })
  const [bookingOpen, setBookingOpen] = useState(false)
  const [departurePickerOpen, setDeparturePickerOpen] = useState(false)
  const [pricePatches, setPricePatches] = useState<ProductPriceRow[]>([])
  const [onDemandNotice, setOnDemandNotice] = useState<string | null>(null)
  const [departureCollectOpen, setDepartureCollectOpen] = useState(false)
  const [calendarDateKey, setCalendarDateKey] = useState<string | null>(() => {
    const row = pickVerygoodPublicDefaultDepartureRow(product.prices ?? [])
    return row ? toDateKey(row.date) : null
  })

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
    const row = pickVerygoodPublicDefaultDepartureRow(product.prices ?? [])
    setSelectedDepartureRowId(row?.id ?? null)
    setCalendarDateKey(row ? toDateKey(row.date) : null)
  }, [String(product.id)])

  const defaultDepartureRow = useMemo(
    () => pickVerygoodPublicDefaultDepartureRow(mergedPrices),
    [mergedPrices]
  )

  useEffect(() => {
    if (departureUserPinned) return
    if (!defaultDepartureRow) {
      setSelectedDepartureRowId(null)
      setCalendarDateKey(null)
      return
    }
    setSelectedDepartureRowId((prev) => (prev === defaultDepartureRow.id ? prev : defaultDepartureRow.id))
    setCalendarDateKey((prev) => {
      const next = toDateKey(defaultDepartureRow.date)
      return prev === next ? prev : next
    })
  }, [departureUserPinned, defaultDepartureRow?.id, defaultDepartureRow?.date])

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
          setOnDemandNotice('Ï∂úÎ∞ú???ïÎ≥¥Î•?Î∂àÎü¨?§Îäî Ï§?Î¨∏Ï†úÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§. ?§Ïãú ?úÎèÑ??Ï£ºÏÑ∏??')
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
          setOnDemandNotice('?†ÌÉù?òÏã† ?†Ïßú?êÎäî Ï∂úÎ∞ú Í∞Ä?•Ìïú ?ÅÌíà???ÜÏäµ?àÎã§.')
          if (parsed.refreshRouter) router.refresh()
          return
        }
        if (parsed.kind === 'price_unavailable') {
          setOnDemandNotice('?¥Îãπ ?†Ïßú Ï∂úÎ∞ú?Ä ?àÏúº??Í∞ÄÍ≤©ÏùÑ ?ÑÏßÅ ?ïÏù∏?òÏ? Î™ªÌñà?µÎãà??')
          return
        }
        setOnDemandNotice('Ï∂úÎ∞ú???ïÎ≥¥Î•?Î∂àÎü¨?§Îäî Ï§?Î¨∏Ï†úÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§. ?§Ïãú ?úÎèÑ??Ï£ºÏÑ∏??')
      } catch {
        setOnDemandNotice('Ï∂úÎ∞ú???ïÎ≥¥Î•?Î∂àÎü¨?§Îäî Ï§?Î¨∏Ï†úÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§. ?§Ïãú ?úÎèÑ??Ï£ºÏÑ∏??')
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
      setSelectedDepartureRowId(null)
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
      lines.push(`?ÑÏ??êÏÑú ${product.mandatoryCurrency} ${product.mandatoryLocalFee}(?∏Îãπ) Î≥ÑÎèÑ ÏßÄÎ∂àÏù¥ ?ÑÏöî???ÅÌíà?ÖÎãà??)
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

  const detailScope = product.primaryRegion === 'Íµ?Ç¥' ? 'domestic' : 'overseas'
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
    const raw = pickDepartureKeyFactsForSelection({
      selectedDate,
      selectedDepartureRowId,
      selectedPriceRowId: selectedPriceRow?.id ?? null,
      departureKeyFactsByDate: product.departureKeyFactsByDate ?? null,
      departureKeyFactsByDepartureId: product.departureKeyFactsByDepartureId ?? null,
    })
    /** Ï∂úÎ∞ú??ProductDeparture) SSOT ??Î≥∏Î¨∏¬∑Íµ¨Ï°∞??flightManualCorrection ??leg/??≥µ?¨Î? ??ñ¥?∞Î©¥ 11?îÍ?Í≤?7?îÌï≠Í≥?Í∞ôÏ? ?ûÏûÑ Î∞úÏÉù */
    if (normalizeSupplierOrigin(product.originSource) === 'verygoodtour') return raw
    if (product.applyFlightManualCorrectionOverlay && product.flightManualCorrection) {
      return applyFlightManualCorrectionForPublicOrigin(raw, product.flightManualCorrection, product.originSource)
    }
    return raw
  }, [
    selectedDate,
    selectedDepartureRowId,
    selectedPriceRow?.id,
    product.departureKeyFactsByDate,
    product.departureKeyFactsByDepartureId,
    product.applyFlightManualCorrectionOverlay,
    product.flightManualCorrection,
    product.originSource,
  ])

  const packageTotalDays = getProductTotalDays(
    product,
    product.schedule?.length ? product.schedule.length : null
  )
  const calendarAlignedDepartureFacts = useMemo(
    () =>
      alignDepartureKeyFactsToSelectedCalendarDate(selectedDepartureFacts, selectedDate, {
        packageTotalDays,
      }),
    [selectedDepartureFacts, selectedDate, packageTotalDays]
  )

  const productForMetaChips = useMemo(() => {
    const air = selectedDepartureFacts?.airline?.trim()
    if (normalizeSupplierOrigin(product.originSource) !== 'verygoodtour' || !air) return product
    if (product.airline?.trim() === air) return product
    return { ...product, airline: air }
  }, [product, selectedDepartureFacts])

  /** Íº??åÏïÑ?????¨Ìï≠: `mustKnowItems`Îß?Í≥µÍ∏â??Í≥µÌÜµ). ÎπÑÎ©¥ Í∏∞Î≥∏ ?àÎÇ¥ Î¨∏Íµ¨. */
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
    const base = buildProductMetaChips(productForMetaChips, {
      departureFactsOverride: selectedDepartureFacts,
      prioritizeDepartureFactsForRouting: true,
    })
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
  }, [product, productForMetaChips, selectedDepartureFacts])

  const departureConditionLine = useMemo(() => {
    if (normalizeSupplierOrigin(product.originSource) !== 'hanatour') {
      return formatDepartureConditionForProduct(product)
    }
    return formatHanatourDepartureConditionForProduct(product)
  }, [product])

  const meetingDefault = useMemo(() => {
    const merged = [product.meetingInfoRaw?.trim(), product.meetingPlaceRaw?.trim()].filter(Boolean).join(' ¬∑ ')
    if (merged.trim()) return merged.trim()
    const fb = product.meetingFallbackText?.trim()
    if (fb) return fb
    return 'ÎØ∏ÌåÖ?•ÏÜå???ÅÎã¥ ???ïÏù∏?òÏó¨ ?àÎÇ¥?úÎ¶¨Í≤†Ïäµ?àÎã§.'
  }, [product.meetingInfoRaw, product.meetingPlaceRaw, product.meetingFallbackText])

  const selectedDepartureCurrentPrice = selectedPriceRow
    ? computeKRWQuotation(selectedPriceRow, { adult: 1, childBed: 0, childNoBed: 0, infant: 0 }).total
    : null

  const { departureDisplay: heroDepartureDisplay, returnDisplay: heroReturnDisplay, durationLabel: rowDurationLabel } =
    useMemo(
      () =>
        buildVerygoodTripDateDisplaysForSelectedRow({
          calendarDep: selectedDate,
          facts: calendarAlignedDepartureFacts,
        }),
      [selectedDate, calendarAlignedDepartureFacts]
    )

  const travelCitiesLine = useMemo(
    // REGRESSION-FREEZE[public-card-no-kr-departure-place]: travelCities dest scrub ??manifest
    () => formatPublicDestinationDisplayLabel(product.primaryDestination, product.destination),
    [product.primaryDestination, product.destination],
  )

  const reservationDisplayLine = useMemo(() => {
    const base = departureConditionLine?.trim() || ''
    const seats = selectedPriceRow?.availableSeats
    const bits: string[] = []
    if (base) bits.push(base)
    if (seats != null && seats >= 0) bits.push(`?¨Ïú†Ï¢åÏÑù ??${seats}??)
    const rowStatus = selectedPriceRow?.status?.trim()
    if (rowStatus && !bits.some((b) => b.includes(rowStatus))) bits.push(rowStatus)
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
    return bits.length ? bits.join(' ¬∑ ') : null
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
        <span className={HERO_DATE_INLINE_VALUE_CLASS}>{heroDepartureDisplay ?? '??}</span>
        <span className="text-bt-disabled"> ~ </span>
        <span className={HERO_DATE_INLINE_VALUE_CLASS}>{heroReturnDisplay ?? '??}</span>
        {rowDurationLabel ? (
          <>
            {' '}
            <span className="font-extrabold text-bt-card-accent-strong">{rowDurationLabel}</span>
          </>
        ) : null}
      </>
    ),
    [heroDepartureDisplay, heroReturnDisplay, rowDurationLabel]
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
    <div className="min-h-screen bg-beige">
      <Header />
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
        primaryRegion={product.primaryRegion ?? null}
        infoPanel={{
          dataSourceLabel: formatOriginSourceForDisplay(product.originSource),
          title: product.title,
          originCode: product.originCode,
          destination: product.destination,
          durationLabel: rowDurationLabel?.trim() || product.duration || '',
          airline: selectedDepartureFacts?.airline?.trim() ?? product.airline,
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
          departureAirportLabelDisplay: product.departureAirportLabelDisplay ?? null,
          outboundFlight: formatFlightLegTwoLines(calendarAlignedDepartureFacts?.outbound ?? null),
          inboundFlight: formatFlightLegTwoLines(calendarAlignedDepartureFacts?.inbound ?? null),
        }}
        onChangeDepartureDate={handleChangeDepartureDate}
        showChangeDepartureCta={mergedPrices.length > 0}
        modetourStickyLocalPayLine={product.modetourStickyLocalPayLine ?? null}
      />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-bt-link hover:text-bt-link-hover hover:underline"
        >
          ???ÅÌíà Î™©Î°ù
        </Link>

        {onDemandNotice ? (
          <p className="mt-6 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950">
            {onDemandNotice}
          </p>
        ) : null}

        <div className="mt-6 space-y-8">
            <TravelCoreInfoSection
              facts={calendarAlignedDepartureFacts}
              productAirline={calendarAlignedDepartureFacts?.airline?.trim() ?? null}
              periodContent={periodContent}
              travelCitiesLine={travelCitiesLine}
              reservationLine={reservationDisplayLine}
              meetingDefault={meetingDefault}
              meetingExtra={null}
              metaChips={productMetaChips}
              omitBriefRows={departurePickerOpen}
              flightExposurePolicy={product.flightExposurePolicy ?? null}
            />

            <ProductHighlightPointsSection
              highlightPoints={product.highlightPoints ?? null}
              highlightPointsRaw={product.highlightPointsRaw ?? null}
            />

            <VerygoodProductExtraInfoTabs
              key={String(product.id)}
              product={product}
              uiOptionalRows={uiOptionalRows}
              optionalDisplayInput={optionalDisplayInput}
              shoppingDisplayInput={shoppingDisplayInput}
              optionalToursForSheet={optionalToursForSheet}
              shoppingCount={product.shoppingCount ?? 0}
              shoppingItems={product.shoppingItems ?? null}
              shoppingVisitCountTotal={product.shoppingVisitCountTotal ?? null}
              shoppingNoticeRaw={product.shoppingNoticeRaw ?? null}
              shoppingStopsStructured={product.shoppingStopsStructured ?? null}
            />

            <section className="rounded-2xl border border-bt-border bg-bt-surface p-6">
              <h2 className="mb-4 border-l-4 border-bt-card-title pl-3 text-lg font-semibold text-bt-card-title">?ºÏ†ï ?îÏïΩ</h2>
              {product.listingKind === 'air_hotel_free' ? (
                <p className="bt-wrap mb-6 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-center text-sm font-semibold text-amber-950">
                  ?ÑÎûòÎ≥¥Ïãú???ºÏ†ï?Ä ?àÏãú ?ºÏ†ï?ÖÎãà??
                </p>
              ) : null}
              {product.listingKind !== 'air_hotel_free' &&
              product.freeTimeSummaryText?.trim() &&
              !isScheduleUserPlaceholder(product.freeTimeSummaryText) ? (
                <p className="bt-wrap mb-6 rounded-xl border border-bt-card-accent-border bg-bt-card-accent-soft px-4 py-3 text-center text-sm font-medium text-bt-body">
                  {product.freeTimeSummaryText.trim()}
                </p>
              ) : null}
              {product.schedule && product.schedule.length > 0 ? (
                <div className="space-y-6">
                  {product.schedule.map((day, rowIndex) => {
                    const scheduleLen = product.schedule?.length ?? 0
                    const rawTitle =
                      typeof day === 'object' && day && 'title' in day && typeof (day as { title?: unknown }).title === 'string'
                        ? String((day as { title: string }).title)
                        : ''
                    const sd = day as ScheduleDay
                    const title = resolvePublicScheduleDayTitle(rawTitle, sd.description)
                    const hotelLine = computeVerygoodPublicDayHotelLine({
                      hotelNames: product.hotelNames ?? null,
                      hotelSummaryText: product.hotelSummaryText ?? null,
                      dayHotelText: sd.hotelText ?? null,
                      isLastScheduleRow: scheduleLen > 0 && rowIndex === scheduleLen - 1,
                      dayDescription: String(sd.description ?? ''),
                    })
                    const mealLines = formatMealDisplay({
                      breakfastText: sd.breakfastText,
                      lunchText: sd.lunchText,
                      dinnerText: sd.dinnerText,
                      mealSummaryText: sd.mealSummaryText,
                      mealsLegacy: sd.meals ?? null,
                    })
                    return (
                      <div key={day.day} className="border-b border-bt-border-soft pb-6 last:border-0 last:pb-0">
                        <p className="text-xs font-bold tracking-widest text-bt-card-accent-strong">
                          DAY {String(day.day).padStart(2, '0')}
                        </p>
                        {title ? (
                          <h3 className="mt-1 text-base font-bold text-bt-card-title">{title}</h3>
                        ) : null}
                        {(() => {
                          const scheduleBody = String(sd.description ?? '')
                            .replace(/\r/g, '\n')
                            .trim()
                          if (!scheduleBody || isScheduleUserPlaceholder(scheduleBody)) return null
                          return (
                            <p className="mt-2 whitespace-pre-wrap text-sm font-normal leading-relaxed text-bt-body">
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
                <p className="text-sm text-bt-meta">?±Î°ù???ºÏ†ï ?îÏïΩ???ÜÏäµ?àÎã§.</p>
              )}
            </section>

            <MustKnowEssentialsSection items={mustKnowFiltered} layout="desktop" originSource={product.originSource} />

            {showEsimCrossSell ? <EsimProductDetailCrossSell /> : null}

            <section className="rounded-2xl border border-bt-border-soft bg-bt-surface p-6 text-center">
              <h2 className="text-base font-semibold text-bt-card-title">?àÎÇ¥</h2>
              <p className="bt-wrap mt-2 text-sm font-medium leading-relaxed text-bt-muted">
                Î¨∏Ïùò¬∑?ëÏàò???ÅÎã® ?ÅÌíà ?ïÎ≥¥ ?êÎäî ?ÅÎã¥ Ï±ÑÎÑê???¥Ïö©??Ï£ºÏÑ∏?? Î≥∏Î¨∏?Ä ?ïÎ≥¥ ?ïÏù∏?©ÏûÖ?àÎã§.
              </p>
            </section>
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
      </main>
    </div>
  )
}

export default function VerygoodTravelProductDetail(props: Props) {
  if (isAirHotelFreeListingForUi(props.product.listingKind)) {
    return (
      <TravelProductDetail
        product={props.product as unknown as PackageTravelProduct}
        showEsimCrossSell={props.showEsimCrossSell}
      />
    )
  }
  return <VerygoodTravelProductDetailView {...props} />
}
