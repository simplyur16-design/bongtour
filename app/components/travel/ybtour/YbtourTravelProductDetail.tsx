'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/app/components/Header'
import TravelCoreInfoSection from '@/app/components/detail/TravelCoreInfoSection'
import YbtourProductExtraInfoTabs from '@/app/components/travel/ybtour/YbtourProductExtraInfoTabs'
import { filterPublicMustKnowItemsForTripReadiness } from '@/lib/public-must-know-display'
import MustKnowEssentialsSection from '@/app/components/travel/MustKnowEssentialsSection'
import type { PublicPricePromotionView, ShoppingStopRow } from '@/lib/public-product-extras'
import {
  buildPublicOptionalDisplayInputFromProductFields,
  buildPublicShoppingDisplayInputFromProductFields,
} from '@/lib/public-product-extras'
import { isBannedOptionalTourName } from '@/lib/optional-tour-row-gate-hanatour'
import { parseLegacyStructuredOptionalTours, toLegacyBookingTypeLabel } from '@/lib/optional-tours-ui-model'
import { getYbtourOptionalTourUiRows } from '@/lib/optional-tours-ui-ybtour'
import { computeKRWQuotation, isScheduleAdultBookable } from '@/lib/price-utils'
import { pickGloballyCheapestDepartureRowByAdultPrice } from '@/lib/public-default-departure-selection'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { buildModetourHeroHaystackFromProduct } from '@/lib/modetour-body-dates'
import { buildYbtourTripDateDisplaysForSelectedRow } from '@/lib/ybtour/ybtour-selected-row-trip-display'
import ProductHeroCarousel from '@/app/components/detail/ProductHeroCarousel'
import DepartureDatePickerModal from '@/app/components/detail/DepartureDatePickerModal'
import ProductLiveQuoteCard from '@/app/components/detail/ProductLiveQuoteCard'
import BookingIntakeModal from '@/app/components/travel/BookingIntakeModal'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcHanatour } from '@/lib/flight-manual-correction-hanatour'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcModetour } from '@/lib/flight-manual-correction-modetour'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcYbtour } from '@/lib/flight-manual-correction-ybtour'
import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'
import type { FlightStructuredBody } from '@/lib/public-product-extras'
import type { PublicPersistedFlightStructuredDto } from '@/lib/public-flight-structured-sanitize'
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
import { formatScheduleDayHotelLine, formatMealDisplay, getHotelMealLabels } from '@/lib/hotel-meal-display'
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
import { coverImageUrlForTravelProductClient } from '@/lib/travel-product-cover-url'

/** Prisma ProductPrice + 견적용 price* (lib/price-utils PriceRowLike 호환) */
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
  /** 달력 행 잔여석 등 — 있으면 예약인원 행에 보조 표기 */
  availableSeats?: number
  /** ProductDeparture.seatsStatusRaw — 숫자 좌석과 별도의 예약/잔여 문구 */
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
  /** 대표 이미지 출처 타입(Product.bgImageSource) — 히어로 배지 */
  bgImageSource?: string | null
  /** AI 생성 표기(Product.bgImageIsGenerated) */
  bgImageIsGenerated?: boolean | null
  /** 일정 표시명 없을 때 image_assets 메타로 히어로 첫 슬라이드 캡션 보강 */
  heroCoverCaptionFromAsset?: string | null
  heroImageSeoKeywordOverlay?: string | null
  optionalTours?: Array<{ id: string; name: string; priceUsd: number; duration: string; waitPlaceIfNotJoined: string }>
  shoppingCount?: number | null
  shoppingItems?: string | null
  optionalTourNoticeRaw?: string | null
  optionalTourNoticeItems?: string[]
  optionalTourDisplayNoticeFinal?: string | null
  /** structuredSignals.optionalToursPasteRaw — 구조화 0행 시 현지옵션 탭 SSOT 원문 */
  optionalToursPasteRaw?: string | null
  shoppingVisitCountTotal?: number | null
  shoppingNoticeRaw?: string | null
  /** structuredSignals.shoppingPasteRaw — 구조화 0행 시 쇼핑 탭 SSOT 원문 */
  shoppingPasteRaw?: string | null
  shoppingStopsStructured?: ShoppingStopRow[] | null
  freeTimeSummaryText?: string | null
  hasFreeTime?: boolean | null
  hasOptionalTours?: boolean | null
  pricePromotionView?: PublicPricePromotionView | null
  benefitSummary?: string | null
  promotionLabelsRaw?: string | null
  priceFrom?: number | null
  priceCurrency?: string | null
  /** 출발일별 항공·미팅 요약 (YYYY-MM-DD) */
  departureKeyFactsByDate?: Record<string, DepartureKeyFacts>
  /** rawMeta 항공 본문 — 출발행 비어 있을 때 항공 카드 보강 */
  flightStructured?: FlightStructuredBody | null
  /** 노랑풍선 히어로 출발·귀국 시각 — 서버에서 rawMeta leg만 전달 */
  ybtourFlightStructuredForHero?: PublicPersistedFlightStructuredDto | null
  /** 본문 가격표 원문 — 인원 카드 연령 기준 추출 */
  priceTableRawText?: string | null
  hotelSummaryRaw?: string | null
  hotelSummaryText?: string | null
  hotelNames?: string[] | null
  /** 일차별 예정호텔(서버에서 structured·일정·본문 파서 병합) */
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
  /** rawMeta structured — 불포함 카드 병합용 */
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
  /** structuredSignals.flightManualCorrection — legacy_parsed 표시 시 편명/시간만 */
  flightManualCorrection?: FlightManualCorrectionPayload | null
  /** 본문 파싱 항공만 노출될 때 수동 보정 적용 */
  applyFlightManualCorrectionOverlay?: boolean
  /** 모두투어: 출발일 변경 CTA 바로 아래 현지 지불경비(인당) 한 줄 */
  modetourStickyLocalPayLine?: string | null
  /** travel | private_trip | air_hotel_free — 항공권+호텔(자유여행) UI 분기 */
  listingKind?: string | null
}

function toDateKey(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

type Props = { product: TravelProduct }

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

export default function YbtourTravelProductDetail({ product }: Props) {
  const [departureUserPinned, setDepartureUserPinned] = useState(false)
  const [selectedDepartureRowId, setSelectedDepartureRowId] = useState<string | null>(null)
  const [pax, setPax] = useState({ adult: 1, childBed: 0, childNoBed: 0, infant: 0 })
  const [bookingOpen, setBookingOpen] = useState(false)
  const [departurePickerOpen, setDeparturePickerOpen] = useState(false)

  useEffect(() => {
    setDepartureUserPinned(false)
  }, [String(product.id)])

  const defaultDepartureRow = useMemo(
    () => pickGloballyCheapestDepartureRowByAdultPrice(product.prices),
    [product.prices]
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
    const row = product.prices.find((p) => p.id === selectedDepartureRowId)
    if (!row || !isScheduleAdultBookable(row)) {
      setDepartureUserPinned(false)
      setSelectedDepartureRowId(null)
    }
  }, [product.prices, selectedDepartureRowId])

  const selectedPriceRow = useMemo(() => {
    if (selectedDepartureRowId) {
      const r = product.prices.find((p) => p.id === selectedDepartureRowId)
      if (r && isScheduleAdultBookable(r)) return r
    }
    return defaultDepartureRow
  }, [product.prices, selectedDepartureRowId, defaultDepartureRow])

  const selectedDate = selectedPriceRow ? toDateKey(selectedPriceRow.date) : null

  const structuredOptionalTours = useMemo(
    () => parseLegacyStructuredOptionalTours(product.optionalToursStructured),
    [product.optionalToursStructured]
  )
  const uiOptionalRows = useMemo(
    () => getYbtourOptionalTourUiRows(product.optionalToursStructured, product.optionalToursPasteRaw),
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

  const hasBookableSchedule = useMemo(
    () => product.prices.some((p) => isScheduleAdultBookable(p)),
    [product.prices]
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

  const detailScope = product.primaryRegion === '국내' ? 'domestic' : 'overseas'
  const labels = getHotelMealLabels(detailScope)

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

  const { departureDisplay: heroDepartureDisplay, returnDisplay: heroReturnDisplay } = useMemo(
    () =>
      buildYbtourTripDateDisplaysForSelectedRow({
        calendarDep: selectedPriceRow ? toDateKey(selectedPriceRow.date) : null,
        facts: selectedDepartureFacts,
        duration: product.duration,
      }),
    [selectedPriceRow, selectedDepartureFacts, product.duration]
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
    const seats = selectedPriceRow?.availableSeats
    const bits: string[] = []
    if (base) bits.push(base)
    if (seats != null && seats >= 0) bits.push(`여유좌석 약 ${seats}석`)
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
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-bt-link hover:text-bt-link-hover hover:underline"
        >
          ← 상품 목록
        </Link>

        <section className="mt-4 overflow-hidden bt-card-strong">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center">
            <div className="min-w-0 lg:flex lg:items-center">
              <ProductHeroCarousel
                heroUrl={heroUrl}
                daySlides={daySlides}
                productTitle={product.title}
                className="w-full rounded-none border-0"
                heroImageSourceType={product.bgImageSource ?? null}
                heroImageIsGenerated={product.bgImageIsGenerated ?? null}
                heroImageSeoKeywordOverlay={product.heroImageSeoKeywordOverlay ?? null}
                primaryDestination={product.primaryDestination ?? null}
                destination={product.destination ?? null}
              />
            </div>
            <div className="p-5 sm:p-6">
              <div className="inline-flex items-center rounded-lg border border-bt-border bg-bt-disclosure px-2.5 py-1 text-xs font-medium text-bt-meta">
                데이터 출처: {formatOriginSourceForDisplay(product.originSource)}
              </div>
              <ProductDetailTitle
                title={product.title}
                className="bt-wrap mt-4 text-2xl font-black leading-[1.2] tracking-[0.02em] text-bt-title sm:text-3xl"
              />
              <p className="bt-wrap mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-relaxed text-bt-body">
                <span className="bt-code-wrap font-mono text-xs font-semibold text-bt-meta">{product.originCode}</span>
                <span className="text-bt-disabled">·</span>
                <span className="font-medium text-bt-title">{product.destination}</span>
                <span className="text-bt-disabled">·</span>
                <span>{product.duration}</span>
                {selectedDepartureFacts?.airline?.trim() ? (
                  <>
                    <span className="text-bt-disabled">·</span>
                    <span className="text-bt-muted">{selectedDepartureFacts.airline.trim()}</span>
                  </>
                ) : null}
              </p>

              {(heroPriceSsot.selectedDeparturePrice != null || heroBenefitWhenNoDiscount || heroCouponText) && (
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
                        {heroReturnDisplay ?? '상담 시 안내'}
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
                        {heroPriceSsot.selectedDeparturePrice != null ? (
                          <p className="text-[11px] text-bt-meta">{PRICE_MAIN_AMOUNT_HINT}</p>
                        ) : null}
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
              )}

              {departureConditionLine?.trim() ? (
                <p className="mt-3 text-center text-[11px] font-semibold leading-snug text-bt-card-accent-strong">
                  {departureConditionLine.trim()}
                </p>
              ) : null}

              {productMetaChips.length > 0 && (
                <div className="mt-3 border-t border-bt-border-soft pt-3">
                  <ProductMetaChips chips={productMetaChips} variant="light" className="w-full" />
                </div>
              )}
              {isAirHotelFreeListingForUi(product.listingKind) && (
                <div className="mt-2">
                  <span className="inline-flex rounded-full border border-bt-card-accent-border bg-bt-card-accent-soft px-2.5 py-1 text-xs font-semibold text-bt-card-title">
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
            </div>
          </div>
        </section>

        <div className="mt-6 lg:hidden">
          <ProductLiveQuoteCard
            product={product}
            prices={product.prices}
            selectedDate={selectedDate}
            explicitPriceRow={selectedPriceRow}
            pax={pax}
            updatePax={updatePax}
            updateChildCombined={updateChildCombined}
            highRiskAlerts={highRiskAlerts}
            onBookingOpen={() => setBookingOpen(true)}
            onOpenDeparturePicker={() => setDeparturePickerOpen(true)}
            variant="desktop"
            fromScreen="product_detail_desktop"
            departureConditionLine={departureConditionLine}
            heroTripDepartureDisplay={heroDepartureDisplay}
            heroTripReturnDisplay={heroReturnDisplay}
            modetourStickyLocalPayLine={product.modetourStickyLocalPayLine ?? null}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="space-y-8">
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

            <section className="rounded-2xl border border-bt-border bg-bt-surface p-6">
              <h2 className="mb-4 border-l-4 border-bt-card-title pl-3 text-lg font-semibold text-bt-card-title">일정 요약</h2>
              {product.listingKind === 'air_hotel_free' ? (
                <p className="bt-wrap mb-6 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-center text-sm font-semibold text-amber-950">
                  아래보시는 일정은 예시 일정입니다.
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
                  {product.schedule.map((day) => {
                    const rawTitle =
                      typeof day === 'object' && day && 'title' in day && typeof (day as { title?: unknown }).title === 'string'
                        ? String((day as { title: string }).title)
                        : ''
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
                <p className="text-sm text-bt-meta">등록된 일정 요약이 없습니다.</p>
              )}
            </section>

            <YbtourProductExtraInfoTabs
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

            <MustKnowEssentialsSection items={mustKnowFiltered} layout="desktop" originSource={product.originSource} />

            <section className="rounded-2xl border border-bt-border-soft bg-bt-surface p-6 text-center">
              <h2 className="text-base font-semibold text-bt-card-title">안내</h2>
              <p className="bt-wrap mt-2 text-sm font-medium leading-relaxed text-bt-muted">
                문의·접수는 우측 <strong className="font-semibold text-bt-card-title">실시간 견적</strong> 카드에서 진행해 주세요. 본문은 정보 확인용입니다.
              </p>
            </section>
          </div>

          <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
            <div className="max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
              <ProductLiveQuoteCard
                product={product}
                prices={product.prices}
                selectedDate={selectedDate}
                explicitPriceRow={selectedPriceRow}
                pax={pax}
                updatePax={updatePax}
                updateChildCombined={updateChildCombined}
                highRiskAlerts={highRiskAlerts}
                onBookingOpen={() => setBookingOpen(true)}
                onOpenDeparturePicker={() => setDeparturePickerOpen(true)}
                variant="desktop"
                fromScreen="product_detail_desktop"
                departureConditionLine={departureConditionLine}
                heroTripDepartureDisplay={heroDepartureDisplay}
                heroTripReturnDisplay={heroReturnDisplay}
                modetourStickyLocalPayLine={product.modetourStickyLocalPayLine ?? null}
              />
            </div>
          </aside>
        </div>

        <DepartureDatePickerModal
          open={departurePickerOpen}
          onClose={() => setDeparturePickerOpen(false)}
          prices={product.prices}
          originSource={product.originSource}
          selectedDate={selectedDate}
          selectedSourceRowId={selectedPriceRow?.id ?? null}
          onSelectDate={() => {}}
          onSelectDeparture={({ sourceRowId }) => {
            setSelectedDepartureRowId(sourceRowId)
            setDepartureUserPinned(true)
          }}
          filterDepartureListByCalendarMonth
          listFirst={false}
        />

        <BookingIntakeModal
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
          productId={String(product.id)}
          productTitle={product.title}
          originSource={product.originSource}
          originCode={product.originCode}
          selectedDateFromCalendar={selectedDate}
          pax={pax}
          hasPriceSchedule={hasBookableSchedule}
        />
      </main>
    </div>
  )
}
