'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Car, Bed, UtensilsCrossed, Mountain, ShoppingBag, Coffee, Lightbulb,
  Clock, MapPin, Route,
} from 'lucide-react'
import DepartureDatePickerModal from '@/app/components/detail/DepartureDatePickerModal'
import FitItineraryHeroSection from '@/app/components/detail/FitItineraryHeroSection'
import FitItineraryQuoteCard from '@/app/components/detail/FitItineraryQuoteCard'
import type { ProductPriceRow, ScheduleDay } from '@/app/components/travel/TravelProductDetail'
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import type { FlightStructuredBody } from '@/lib/public-product-extras'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { formatScheduleDayHotelLine, formatMealDisplay } from '@/lib/hotel-meal-display'
import { ItineraryExtraInfoBoxes } from '@/components/itinerary/ItineraryExtraInfoBoxes'
import { ScheduleDayItineraryBlocks } from '@/components/itinerary/ScheduleDayItineraryBlocks'
import EsimProductDetailCrossSell from '@/app/components/travel/EsimProductDetailCrossSell'
import {
  pickDepartureKeyFactsForSelection,
  type DepartureKeyFacts,
  type DepartureLegCard,
} from '@/lib/departure-key-facts'
import { pickBookableRowForDateKey } from '@/lib/public-default-departure-selection'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcHanatour } from '@/lib/flight-manual-correction-hanatour'
import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcModetour } from '@/lib/flight-manual-correction-modetour'
import { formatHeroDateKorean } from '@/lib/hero-date-utils'
import { formatFlightLegTwoLines } from '@/lib/flight-user-display'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { computeReturnDate, getProductTotalDays } from '@/lib/package-rules'
import { computeKRWQuotation } from '@/lib/price-utils'
import { buildPriceDisplaySsot } from '@/lib/price-display-ssot'
import type { ProductMetaChip } from '@/lib/product-meta-chips'

type Persona = 'mixed' | 'couple' | 'with-parents' | 'with-kids'
type ItineraryCategory = 'transport' | 'hotel' | 'meal' | 'attraction' | 'shopping' | 'tip' | 'leisure'

interface ItineraryActivity {
  id: string
  order: number
  category: ItineraryCategory
  title: string
  description: string
  location: string | null
  startTime: string
  durationMinutes: number
  estimatedCostKrw: number
  estimatedCostNote: string | null
  transportMode: string | null
  transportDuration: string | null
  transportCostKrw: number | null
  imageUrl?: string | null
  imageKeywords?: string[] | null
  imagePhotographer?: string | null
}

interface ItineraryDay {
  id: string
  dayNumber: number
  title: string
  summary: string
  activities: ItineraryActivity[]
  heroImageUrl?: string | null
  heroImagePhotographer?: string | null
}

type ItineraryMaster = {
  id: string
  title: string
  summary: string
  totalDays: number
  persona: Persona
  cityNameKo: string
  productId: string
  days: ItineraryDay[]
}

type ItineraryFlightLegDisplay = {
  from: string
  to: string
  departureAt: string
  arrivalAt: string
}

type ItineraryFlightDisplay = {
  outbound: ItineraryFlightLegDisplay | null
  inbound: ItineraryFlightLegDisplay | null
}

interface ItineraryViewProps {
  mode: 'example' | 'confirmed' | 'package'
  master: ItineraryMaster | null
  product: {
    id: string
    title: string
    productType?: string | null
    originSource: string
    originCode: string
    bgImageUrl: string | null
    bgImagePhotographer: string | null
    primaryDestination?: string | null
    schedule?: ScheduleDay[] | null
    bgImageSource?: string | null
    bgImageIsGenerated?: boolean | null
    bgImagePlaceName?: string | null
    bgImageRehostSearchLabel?: string | null
    heroImageSeoKeywordOverlay?: string | null
    flightStructured?: FlightStructuredBody | null
    minimumDepartureCount?: number | null
    minimumDepartureText?: string | null
    hotelSummaryText?: string | null
    hotelNames?: string[] | null
    includedText?: string | null
    excludedText?: string | null
    optionalTourSummaryRaw?: string | null
    optionalToursStructured?: string | null
    optionalToursPasteRaw?: string | null
    shoppingCount?: number | null
    shoppingItems?: string | null
    shoppingCautionNoticeRaw?: string | null
    airtelHotelInfoJson?: string | null
    reservationNoticeRaw?: string | null
    duration?: string | null
    mustKnowItems?: Array<{ category: string; title: string; body: string; raw?: string }> | null
    flightAdminJson?: string | null
    travelScope?: 'domestic' | 'overseas' | null
  }
  prices?: ProductPriceRow[]
  departure?: {
    carrierName: string
    outboundFlightNo: string
    outboundDepartureTime: string
    inboundFlightNo: string
    inboundArrivalTime: string
  } | null
  hotelName?: string | null
  priceInfo?: {
    lowestAdultPrice: number
    highestAdultPrice: number
    childBedPrice: number | null
    infantPrice: number | null
    departureDateFrom: string
    departureDateTo: string
    minPaxPerDeparture?: number | null
    totalDays?: number | null
  } | null
  travelCoreInfo?: {
    productAirline: string | null
    travelCitiesLine: string
    meetingDefault: string
    productMetaChips: ProductMetaChip[]
    flightExposurePolicy?: 'public_full' | 'public_limited' | 'admin_only' | null
    departureKeyFactsByDate?: Record<string, DepartureKeyFacts>
    departureKeyFactsByDepartureId?: Record<string, DepartureKeyFacts>
    departureConditionLine?: string | null
    duration?: string | null
    originSource?: string
    applyFlightManualCorrectionOverlay?: boolean
    flightManualCorrection?: FlightManualCorrectionPayload | null
  }
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

const CATEGORY = {
  transport: { color: '#1F1B2D', icon: Car, chipBg: 'rgba(31,27,45,0.08)', chipText: '#1F1B2D', iconColor: 'white', label: '교통' },
  hotel: { color: '#C9C2E3', icon: Bed, chipBg: '#EFEDF8', chipText: '#534AB7', iconColor: '#534AB7', label: '숙소' },
  meal: { color: '#d9a81e', icon: UtensilsCrossed, chipBg: '#FAEEDA', chipText: '#85510B', iconColor: 'white', label: '식사' },
  attraction: { color: '#6B8E5C', icon: Mountain, chipBg: '#E9F0E2', chipText: '#3E5832', iconColor: 'white', label: '관광' },
  shopping: { color: '#E89571', icon: ShoppingBag, chipBg: '#FCE8DC', chipText: '#A24F2E', iconColor: 'white', label: '쇼핑·기념품' },
  leisure: { color: '#FAEED4', icon: Coffee, chipBg: '#FBF4E0', chipText: '#85510B', iconColor: '#85510B', label: '자유시간' },
  tip: { color: '#8B8B95', icon: Lightbulb, chipBg: '#EBEBED', chipText: '#5A5A60', iconColor: 'white', label: '여행 팁' },
} as const

function airportLabel(airport: string | null | undefined, code: string | null | undefined) {
  return airport?.trim() || code?.trim() || ''
}

function datetimeLabel(date: string | null | undefined, time: string | null | undefined) {
  return [date, time].filter((x) => x && String(x).trim()).join(' ')
}

function legToDisplay(leg: FlightStructured['outbound'] | null | undefined): ItineraryFlightLegDisplay | null {
  if (!leg) return null
  const from = airportLabel(leg.departureAirport, leg.departureAirportCode)
  const to = airportLabel(leg.arrivalAirport, leg.arrivalAirportCode)
  const departureAt = datetimeLabel(leg.departureDate, leg.departureTime)
  const arrivalAt = datetimeLabel(leg.arrivalDate, leg.arrivalTime)
  if (!from && !to && !departureAt && !arrivalAt) return null
  return { from, to, departureAt, arrivalAt }
}

function resolveFlightDisplay(flightStructured: FlightStructuredBody | null | undefined): ItineraryFlightDisplay | null {
  const persisted = flightStructured?.modetourPersistedFlightStructured
  if (!persisted) return null
  const outbound = legToDisplay(persisted.outbound)
  const inbound = legToDisplay(persisted.inbound)
  if (!outbound && !inbound) return null
  return { outbound, inbound }
}

function departureLegCardToDisplay(leg: DepartureLegCard | null | undefined): ItineraryFlightLegDisplay | null {
  if (!leg) return null
  const from = leg.departureAirport?.trim() || ''
  const to = leg.arrivalAirport?.trim() || ''
  const departureAt = leg.departureAtText?.trim() || ''
  const arrivalAt = leg.arrivalAtText?.trim() || ''
  if (!from && !to && !departureAt && !arrivalAt) return null
  return { from, to, departureAt, arrivalAt }
}

export function ItineraryView({
  mode,
  master,
  product,
  prices,
  departure,
  hotelName,
  priceInfo,
  travelCoreInfo,
}: ItineraryViewProps) {
  const [activePage, setActivePage] = useState<number | 'all'>(1)
  const [pax, setPax] = useState({ adult: 1, childBed: 0, infant: 0 })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(priceInfo?.departureDateFrom ?? null)
  const dayRefs = useRef<Map<number, HTMLElement>>(new Map())
  const mainContentRef = useRef<HTMLDivElement>(null)

  const pageSize = 2
  const pageCount = master ? Math.ceil(master.totalDays / pageSize) : 0

  const updatePax = (key: keyof typeof pax, delta: number) => {
    setPax((prev) => {
      if (key === 'adult') return { ...prev, adult: Math.max(1, prev.adult + delta) }
      return { ...prev, [key]: Math.max(0, prev[key] + delta) }
    })
  }

  const selectedPriceRow = useMemo(() => {
    if (!prices?.length || !selectedDate) return null
    return (
      pickBookableRowForDateKey(prices, selectedDate) ??
      prices.find((p) => String(p.date).slice(0, 10) === selectedDate) ??
      null
    )
  }, [prices, selectedDate])

  const adultPriceUnit = useMemo(() => {
    if (selectedPriceRow?.priceAdult != null && selectedPriceRow.priceAdult > 0) {
      return selectedPriceRow.priceAdult
    }
    return priceInfo?.lowestAdultPrice ?? 0
  }, [selectedPriceRow, priceInfo])

  const childBedPriceUnit = useMemo(() => {
    if (selectedPriceRow?.priceChildWithBed != null && selectedPriceRow.priceChildWithBed > 0) {
      return selectedPriceRow.priceChildWithBed
    }
    return priceInfo?.childBedPrice ?? adultPriceUnit
  }, [selectedPriceRow, priceInfo, adultPriceUnit])

  const infantPriceUnit = useMemo(() => {
    if (selectedPriceRow?.priceInfant != null && selectedPriceRow.priceInfant > 0) {
      return selectedPriceRow.priceInfant
    }
    return priceInfo?.infantPrice ?? 0
  }, [selectedPriceRow, priceInfo])

  const totalQuote = useMemo(() => {
    if (!priceInfo) return null
    if (selectedPriceRow) {
      return computeKRWQuotation(selectedPriceRow, {
        adult: pax.adult,
        childBed: pax.childBed,
        childNoBed: 0,
        infant: pax.infant,
      }).total
    }
    return (
      pax.adult * adultPriceUnit +
      pax.childBed * childBedPriceUnit +
      pax.infant * infantPriceUnit
    )
  }, [pax, priceInfo, selectedPriceRow, adultPriceUnit, childBedPriceUnit, infantPriceUnit])

  const totalDays = getProductTotalDays(product, master?.totalDays ?? priceInfo?.totalDays ?? null)

  const computedReturnDate = useMemo(() => {
    const dep = selectedDate ?? priceInfo?.departureDateFrom ?? null
    return computeReturnDate(dep, totalDays)
  }, [selectedDate, priceInfo?.departureDateFrom, totalDays])

  const daySlidesData = useMemo(() => {
    type ScheduleRowWithImageMeta = ScheduleDay & {
      imagePhotographer?: string | null
      imageSource?: string | { source?: string } | null
    }
    const resolveScheduleImageSource = (row: ScheduleRowWithImageMeta): string | null => {
      const raw = row.imageSource
      if (typeof raw === 'string') {
        const t = raw.trim()
        return t || null
      }
      if (raw && typeof raw === 'object' && typeof raw.source === 'string') {
        const t = raw.source.trim()
        return t || null
      }
      return null
    }

    const raw = product.schedule as ScheduleDay[] | string | null | undefined
    if (!raw) return []
    let schedule: ScheduleRowWithImageMeta[] = []
    if (typeof raw === 'string') {
      try {
        schedule = JSON.parse(raw) as ScheduleRowWithImageMeta[]
      } catch {
        return []
      }
    } else if (Array.isArray(raw)) {
      schedule = raw
    } else {
      return []
    }
    if (!Array.isArray(schedule) || schedule.length === 0) return []
    return schedule
      .map((d) => ({
        day: d.day,
        imageUrl: d.imageUrl,
        imageDisplayName: d.imageDisplayName,
        title: d.title ?? null,
        imageKeyword: d.imageKeyword ?? null,
        city: d.city ?? null,
        imagePhotographer: d.imagePhotographer ?? null,
        imageSource: resolveScheduleImageSource(d),
      }))
      .filter((s) => s.imageUrl)
  }, [product.schedule])

  useEffect(() => {
    if (!master || activePage !== 'all') return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const dayNum = parseInt(entry.target.getAttribute('data-day') || '1', 10)
            setActivePage(Math.ceil(dayNum / pageSize))
          }
        })
      },
      { rootMargin: '-30% 0px -50% 0px' }
    )
    dayRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [master?.days.length, activePage, pageSize, master])

  const flightDisplay = useMemo(
    () => resolveFlightDisplay(product.flightStructured),
    [product.flightStructured]
  )

  const selectedDepartureFacts = useMemo(() => {
    if (!travelCoreInfo) return null
    const dateKey = selectedDate ?? priceInfo?.departureDateFrom ?? null
    if (!dateKey) return null
    const row = pickDepartureKeyFactsForSelection({
      selectedDate: dateKey,
      selectedPriceRowId: selectedPriceRow?.id ?? null,
      departureKeyFactsByDate: travelCoreInfo.departureKeyFactsByDate ?? null,
      departureKeyFactsByDepartureId: travelCoreInfo.departureKeyFactsByDepartureId ?? null,
    })
    if (travelCoreInfo.applyFlightManualCorrectionOverlay && travelCoreInfo.flightManualCorrection) {
      return applyFlightManualCorrectionForPublicOrigin(
        row,
        travelCoreInfo.flightManualCorrection,
        travelCoreInfo.originSource ?? product.originSource
      )
    }
    return row
  }, [travelCoreInfo, selectedDate, selectedPriceRow?.id, priceInfo?.departureDateFrom, product.originSource])

  const heroFlightDisplay = useMemo(() => {
    const ob = departureLegCardToDisplay(selectedDepartureFacts?.outbound ?? null)
    const ib = departureLegCardToDisplay(selectedDepartureFacts?.inbound ?? null)
    if (ob || ib) return { outbound: ob, inbound: ib }
    return flightDisplay
  }, [selectedDepartureFacts, flightDisplay])

  const heroDepartureDisplay = useMemo(() => {
    const depIso = selectedDate ?? priceInfo?.departureDateFrom ?? null
    return formatHeroDateKorean(depIso) ?? depIso
  }, [selectedDate, priceInfo?.departureDateFrom])

  const heroReturnDisplay = useMemo(() => {
    if (!computedReturnDate) return null
    return formatHeroDateKorean(computedReturnDate) ?? computedReturnDate
  }, [computedReturnDate])

  const heroPriceSsot = useMemo(
    () =>
      buildPriceDisplaySsot(
        selectedPriceRow?.priceAdult ??
          (priceInfo?.lowestAdultPrice != null && priceInfo.lowestAdultPrice > 0
            ? priceInfo.lowestAdultPrice
            : null),
        null
      ),
    [selectedPriceRow?.priceAdult, priceInfo?.lowestAdultPrice]
  )

  const destinationLine =
    travelCoreInfo?.travelCitiesLine?.trim() || product.primaryDestination?.trim() || ''
  const durationLabel = travelCoreInfo?.duration?.trim() || product.duration?.trim() || ''

  const ctaLabel =
    mode === 'example'
      ? '예약 신청'
      : mode === 'confirmed'
        ? '우리끼리 문의'
        : '예약 요청 접수'

  const ctaHref = `/inquiry?type=travel&productId=${product.id}`

  const quoteCardProps = {
    productTitle: product.title,
    originCode: product.originCode,
    destination: destinationLine,
    duration: durationLabel,
    airline: travelCoreInfo?.productAirline ?? null,
    heroTripDepartureDisplay: heroDepartureDisplay,
    heroTripReturnDisplay: heroReturnDisplay,
    pax,
    updatePax,
    adultPriceUnit,
    childBedPriceUnit,
    infantPriceUnit,
    totalQuote,
    ctaHref,
    selectedDate,
    computedReturnDate,
  }

  const switchPage = (next: number | 'all') => {
    setActivePage(next)
    if (typeof window !== 'undefined') {
      const target = mainContentRef.current
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - 100
        window.scrollTo({ top, behavior: 'smooth' })
      }
    }
  }

  return (
    <div className="bg-[#FAFAFC] min-h-screen font-sans">
      <FitItineraryHeroSection
        heroUrl={product.bgImageUrl}
        daySlides={daySlidesData}
        productTitle={product.title}
        heroImageSourceType={product.bgImageSource ?? null}
        heroImagePhotographer={product.bgImagePhotographer ?? null}
        heroImageIsGenerated={product.bgImageIsGenerated ?? null}
        heroImageSeoKeywordOverlay={product.heroImageSeoKeywordOverlay ?? null}
        primaryDestination={product.primaryDestination ?? null}
        destination={product.primaryDestination ?? null}
        onChangeDepartureDate={() => setPickerOpen(true)}
        showChangeDepartureCta={(prices?.length ?? 0) > 0}
        infoPanel={{
          dataSourceLabel: formatOriginSourceForDisplay(product.originSource),
          title: product.title,
          originCode: product.originCode,
          destination: destinationLine,
          durationLabel,
          airline: travelCoreInfo?.productAirline ?? null,
          heroDepartureDisplay,
          heroReturnDisplay,
          duration: durationLabel,
          masterTotalDays: totalDays > 0 ? totalDays : null,
          selectedDepartureIso: selectedDate,
          departureDateFrom: priceInfo?.departureDateFrom ?? null,
          outboundFlight: formatFlightLegTwoLines(selectedDepartureFacts?.outbound ?? null),
          inboundFlight: formatFlightLegTwoLines(selectedDepartureFacts?.inbound ?? null),
          heroPriceSsot,
          heroDiscountSavingsLine: null,
          heroBenefitWhenNoDiscount: null,
          heroCouponText: null,
          departureConditionLine: travelCoreInfo?.departureConditionLine ?? null,
          productMetaChips: travelCoreInfo?.productMetaChips ?? [],
          listingKind: null,
          airportTransferType: null,
        }}
      />

      <div className="mx-4 mt-4 lg:hidden">
        <FitItineraryQuoteCard {...quoteCardProps} variant="mobile" />
      </div>

      {travelCoreInfo ? (
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-8">
          <ItineraryExtraInfoBoxes product={product} section="top" />
        </div>
      ) : null}

      {/* Day 탭 sticky */}
      {master && (
      <div className="sticky top-[72px] sm:top-20 z-20 bg-white border-b border-[#DAD4EE] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-3 flex items-center gap-2 overflow-x-auto">
          <span className="text-sm md:text-base text-[#888780] font-medium whitespace-nowrap mr-2">
            전체 {master.totalDays}일
          </span>
          {Array.from({ length: pageCount }, (_, i) => {
            const pageNum = i + 1
            const startDay = i * pageSize + 1
            const endDay = Math.min(startDay + pageSize - 1, master.totalDays)
            const label = startDay === endDay ? `Day ${startDay}` : `Day ${startDay}-${endDay}`
            return (
              <button
                key={pageNum}
                onClick={() => switchPage(pageNum)}
                className={`px-5 py-2 rounded-full text-sm md:text-base whitespace-nowrap transition ${
                  activePage === pageNum
                    ? 'bg-[#1F1B2D] text-white font-medium'
                    : 'bg-[#F5F2EA] fit-tx-meta hover:bg-[#E5DFC8] font-semibold'
                }`}
              >
                {label}
              </button>
            )
          })}
          <span className="mx-1 text-[#DAD4EE]">|</span>
          <button
            onClick={() => switchPage('all')}
            className={`px-5 py-2 rounded-full text-sm md:text-base whitespace-nowrap transition ${
              activePage === 'all' ? 'bg-[#d9a81e] fit-tx-primary font-bold' : 'bg-[#FAEED4] fit-tx-price hover:bg-[#F5E5B8] font-semibold'
            }`}
          >
            📋 전체 일정 펼치기
          </button>
        </div>
      </div>
      )}

      {/* 본문 */}
      <main ref={mainContentRef} className="max-w-7xl mx-auto px-6 lg:px-8 py-10 lg:grid lg:grid-cols-[1fr_300px] lg:gap-10 lg:items-start">
        <div className="space-y-12 min-w-0">
          {!master && mode === 'example' && (
            <div>
              <h2 className="mb-3 border-l-4 border-[#1F1B2D] pl-3 text-lg md:text-xl font-black tracking-tight fit-tx-primary">
                예시 일정 안내
              </h2>
              <div className="rounded-2xl bg-[#FAEED4]/60 border border-[#d9a81e]/30 px-6 py-12 text-center">
                <p className="text-base md:text-lg fit-tx-gold font-bold mb-2">
                  예시 일정 준비 중입니다
                </p>
                <p className="text-sm fit-tx-meta mb-6">
                  {product.title}의 예시 일정을 만들어 드리고 있습니다.<br />
                  상담 신청 시 빠르게 도와드립니다.
                </p>
                <Link href={ctaHref} className="inline-flex items-center gap-2 bg-[#d9a81e] text-[#1F1B2D] font-bold px-6 py-3 rounded-full text-sm hover:bg-[#c89619] transition">
                  {ctaLabel}
                </Link>
              </div>
            </div>
          )}

          {master && mode === 'example' && (
            <>
              <h2 className="mb-3 border-l-4 border-[#1F1B2D] pl-3 text-lg md:text-xl font-black tracking-tight fit-tx-primary">
                예시 일정 안내
              </h2>
              <div className="rounded-2xl bg-[#FAEED4]/60 border border-[#d9a81e]/30 px-6 py-5 mb-6">
                <p className="text-center text-sm md:text-base fit-tx-primary leading-relaxed">
                  아래 일정은 <strong className="fit-tx-gold">예시 일정</strong>으로 자유여행에 참고하시라고 만들어드린 것입니다.
                </p>
              </div>
            </>
          )}

          {!master ? (
            mode === 'package' && product.schedule && product.schedule.length > 0 ? (
              <div className="space-y-10">
                {product.schedule.map((day, idx) => {
                  const lastDay =
                    product.schedule?.length ?
                      Math.max(
                        ...product.schedule.map((d) => Math.floor(Number(d.day))).filter((n) => Number.isFinite(n) && n >= 1)
                      )
                    : 0
                  const dayNum = Math.floor(Number(day.day))
                  const summaryLead = day.description
                    ? `${day.description.split(/[.\n]/)[0]?.trim() ?? ''}.`
                    : null

                  return (
                    <section key={idx} className="space-y-4">
                      <div className="border-b border-[#DAD4EE] pb-4">
                        <p className="text-xs font-bold tracking-widest fit-tx-gold mb-1">DAY {day.day}</p>
                        <h2 className="text-2xl md:text-3xl font-black fit-tx-primary mb-2">
                          {day.title || `Day ${day.day}`}
                        </h2>
                        {summaryLead ? (
                          <p className="text-sm fit-tx-meta line-clamp-2">{summaryLead}</p>
                        ) : null}
                      </div>
                      <ScheduleDayItineraryBlocks
                        day={day}
                        hotelNames={product.hotelNames ?? null}
                        hotelSummaryText={product.hotelSummaryText ?? null}
                        isLastScheduleRow={lastDay > 0 && dayNum === lastDay}
                      />
                    </section>
                  )
                })}
              </div>
            ) : null
          ) : (
          <>
          {master.days
            .filter(function (day) {
              if (activePage === 'all') return true
              const startDay = (activePage - 1) * pageSize + 1
              const endDay = Math.min(startDay + pageSize - 1, master.totalDays)
              return day.dayNumber >= startDay && day.dayNumber <= endDay
            })
            .map(function (day) {
              const isLastInPaging = activePage !== 'all' && day.dayNumber === Math.min(activePage * pageSize, master.totalDays)
              const isFirstInPaging = activePage !== 'all' && day.dayNumber === (activePage - 1) * pageSize + 1
              const isFinalPage = (activePage !== 'all' && activePage === pageCount && day.dayNumber === master.totalDays) || (activePage === 'all' && day.dayNumber === master.totalDays)

              return (
                <section
                  key={day.id}
                  data-day={day.dayNumber}
                  ref={(el) => { if (el) dayRefs.current.set(day.dayNumber, el) }}
                  className="scroll-mt-24"
                >
                  <div className="pb-4 border-b border-[#DAD4EE] mb-4">
                    <div className="text-sm md:text-base fit-tx-gold font-black mb-2 tracking-widest">DAY {day.dayNumber}</div>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold fit-tx-primary mb-2">{day.title}</h2>
                    <p className="text-base md:text-lg fit-tx-primary leading-relaxed">{day.summary}</p>
                  </div>

                  <div className="space-y-3">
                    {day.activities.map((act, ai) => {
                      const cat = CATEGORY[act.category]
                      const Icon = cat.icon
                      const isLast = ai === day.activities.length - 1
                      return (
                        <div key={act.id} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3">
                          <div className="flex flex-col items-center pt-2">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cat.color }}>
                              <Icon size={18} color={cat.iconColor} strokeWidth={1.8} />
                            </div>
                            {!isLast && <div className="w-px flex-1 mt-2 min-h-[20px]" style={{ borderLeft: '1px dashed #DAD4EE' }} />}
                          </div>
                          <div className="bg-white border border-[#DAD4EE] rounded-xl p-4 shadow-sm">
                            <span className="inline-block text-xs px-2.5 py-1 rounded-full font-medium mb-2 tracking-wide" style={{ background: cat.chipBg, color: cat.chipText }}>
                              {cat.label}
                            </span>
                            <h3 className="text-base md:text-lg font-semibold fit-tx-primary mb-1.5">{act.title}</h3>
                            <p className="text-sm md:text-base fit-tx-primary leading-relaxed mb-2">{act.description}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1.5 items-center text-xs md:text-sm fit-tx-meta">
                              <span className="inline-flex items-center gap-1"><Clock size={14} /> {act.durationMinutes}분</span>
                              {act.location && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {act.location}</span>}
                              {act.transportMode && act.transportDuration && (
                                <span className="inline-flex items-center gap-1"><Route size={14} /> {act.transportMode} {act.transportDuration}</span>
                              )}
                              {act.estimatedCostKrw > 0 && <span className="font-semibold fit-tx-price">₩{act.estimatedCostKrw.toLocaleString()}</span>}
                              {act.estimatedCostNote && <span className="text-xs text-[#B4B2A9]">{act.estimatedCostNote}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {activePage !== 'all' && isLastInPaging && (
                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#DAD4EE]">
                      <div>
                        {!isFirstInPaging && (
                          <button
                            onClick={() => switchPage((activePage as number) - 1)}
                            className="inline-flex items-center gap-2 text-sm md:text-base fit-tx-meta hover:fit-tx-primary transition font-medium"
                          >
                            ← Day {((activePage as number) - 2) * pageSize + 1}-{Math.min(((activePage as number) - 1) * pageSize, master.totalDays)}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <a
                          href={ctaHref}
                          className="text-sm md:text-base fit-tx-meta hover:fit-tx-primary transition underline underline-offset-4"
                        >
                          {ctaLabel}
                        </a>
                        {isLastInPaging && activePage !== pageCount && (
                          <button
                            onClick={() => switchPage((activePage as number) + 1)}
                            className="inline-flex items-center gap-2 bg-[#1F1B2D] text-white px-6 py-3 rounded-full text-sm md:text-base font-semibold hover:bg-[#2C283D] transition"
                          >
                            Day {(activePage as number) * pageSize + 1}-{Math.min(((activePage as number) + 1) * pageSize, master.totalDays)} →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isFinalPage && (
                    <div className="mt-12 rounded-3xl bg-gradient-to-br from-[#1F1B2D] to-[#2C2840] p-10 md:p-14 text-center text-white">
                      <h4 className="text-2xl md:text-3xl font-bold mb-3">여정의 마무리</h4>
                      <p className="text-base md:text-lg opacity-90 mb-8 max-w-xl mx-auto">
                        이 일정 그대로 떠나고 싶으시면<br />봉투어 자유여행 상담을 이용해보세요.
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link href={ctaHref} className="inline-block bg-[#d9a81e] fit-tx-primary px-10 py-4 rounded-full text-base md:text-lg font-bold hover:bg-[#c79a1c] transition shadow-xl">
                          {ctaLabel} →
                        </Link>
                        <button
                          onClick={() => switchPage(1)}
                          className="inline-block bg-transparent text-white border border-white/40 px-8 py-4 rounded-full text-sm md:text-base font-medium hover:bg-white/10 transition"
                        >
                          ↺ 처음부터 다시 보기
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )
            })}
          </>
          )}

          {heroFlightDisplay ? (
            <div className="mb-6">
              <h2 className="mb-3 border-l-4 border-[#1F1B2D] pl-3 text-lg md:text-xl font-black tracking-tight fit-tx-primary">
                항공편 정보
              </h2>
              <div className="rounded-2xl bg-white border border-[#DAD4EE] px-6 py-5 space-y-3">
                {heroFlightDisplay.outbound ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm fit-tx-primary">
                    <span className="rounded-full bg-[#1F1B2D] text-white px-2.5 py-1 text-xs font-bold">출국</span>
                    {heroFlightDisplay.outbound.from ? (
                      <span className="font-semibold">{heroFlightDisplay.outbound.from}</span>
                    ) : null}
                    {heroFlightDisplay.outbound.departureAt ? (
                      <span className="tabular-nums">{heroFlightDisplay.outbound.departureAt}</span>
                    ) : null}
                    <span className="text-[#DAD4EE]">→</span>
                    {heroFlightDisplay.outbound.to ? (
                      <span className="font-semibold">{heroFlightDisplay.outbound.to}</span>
                    ) : null}
                    {heroFlightDisplay.outbound.arrivalAt ? (
                      <span className="tabular-nums">{heroFlightDisplay.outbound.arrivalAt}</span>
                    ) : null}
                  </div>
                ) : null}
                {heroFlightDisplay.inbound ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm fit-tx-primary">
                    <span className="rounded-full bg-[#1F1B2D] text-white px-2.5 py-1 text-xs font-bold">귀국</span>
                    {heroFlightDisplay.inbound.from ? (
                      <span className="font-semibold">{heroFlightDisplay.inbound.from}</span>
                    ) : null}
                    {heroFlightDisplay.inbound.departureAt ? (
                      <span className="tabular-nums">{heroFlightDisplay.inbound.departureAt}</span>
                    ) : null}
                    <span className="text-[#DAD4EE]">→</span>
                    {heroFlightDisplay.inbound.to ? (
                      <span className="font-semibold">{heroFlightDisplay.inbound.to}</span>
                    ) : null}
                    {heroFlightDisplay.inbound.arrivalAt ? (
                      <span className="tabular-nums">{heroFlightDisplay.inbound.arrivalAt}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <ItineraryExtraInfoBoxes product={product} section="bottom" />

          <EsimProductDetailCrossSell primaryDestination={product.primaryDestination} />

        </div>

        <aside className="hidden lg:block lg:sticky lg:top-[100px] lg:self-start">
          <div className="max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
            <FitItineraryQuoteCard {...quoteCardProps} variant="desktop" />
          </div>
        </aside>
      </main>

      <DepartureDatePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        prices={prices ?? []}
        originSource={product.originSource}
        selectedDate={selectedDate}
        onSelectDate={(iso) => { setSelectedDate(iso); setPickerOpen(false); }}
      />
    </div>
  )
}
