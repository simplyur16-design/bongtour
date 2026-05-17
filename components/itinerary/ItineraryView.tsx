'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Car, Bed, UtensilsCrossed, Mountain, ShoppingBag, Coffee, Lightbulb,
  Clock, MapPin, Route,
} from 'lucide-react'
import KakaoCounselCta from '@/app/components/travel/KakaoCounselCta'
import ShareActions from '@/app/components/detail/ShareActions'
import DepartureDatePickerModal from '@/app/components/detail/DepartureDatePickerModal'
import ProductHeroCarousel from '@/app/components/detail/ProductHeroCarousel'
import type { ProductPriceRow, ScheduleDay } from '@/app/components/travel/TravelProductDetail'
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import type { FlightStructuredBody } from '@/lib/public-product-extras'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { formatScheduleDayHotelLine, formatMealDisplay } from '@/lib/hotel-meal-display'
import TravelCoreInfoSection from '@/app/components/detail/TravelCoreInfoSection'
import { HERO_DATE_INLINE_VALUE_CLASS } from '@/app/components/detail/product-detail-visual'
import { ItineraryExtraInfoBoxes } from '@/components/itinerary/ItineraryExtraInfoBoxes'
import EsimProductDetailCrossSell from '@/app/components/travel/EsimProductDetailCrossSell'
import {
  pickDepartureKeyFactsForSelection,
  type DepartureKeyFacts,
  type DepartureLegCard,
} from '@/lib/departure-key-facts'
import { pickBookableRowForDateKey } from '@/lib/public-default-departure-selection'
import { ProductHeroTitleLines } from '@/app/components/detail/product-detail-visual'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcHanatour } from '@/lib/flight-manual-correction-hanatour'
import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcModetour } from '@/lib/flight-manual-correction-modetour'
import { formatHeroDateKorean } from '@/lib/hero-date-utils'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { computeReturnDate, getProductTotalDays } from '@/lib/package-rules'
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

const PAX_STEP_BUTTON_CLASS =
  'inline-flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-lg border border-[#C7BFA1] bg-white text-lg font-semibold leading-none fit-tx-primary shadow-sm transition-colors hover:bg-[#F1EFE8] active:bg-[#FAFAFC] disabled:pointer-events-none disabled:opacity-40'

const CATEGORY = {
  transport: { color: '#1F1B2D', icon: Car, chipBg: 'rgba(31,27,45,0.08)', chipText: '#1F1B2D', iconColor: 'white', label: '교통' },
  hotel: { color: '#C9C2E3', icon: Bed, chipBg: '#EFEDF8', chipText: '#534AB7', iconColor: '#534AB7', label: '숙소' },
  meal: { color: '#d9a81e', icon: UtensilsCrossed, chipBg: '#FAEEDA', chipText: '#85510B', iconColor: 'white', label: '식사' },
  attraction: { color: '#6B8E5C', icon: Mountain, chipBg: '#E9F0E2', chipText: '#3E5832', iconColor: 'white', label: '관광' },
  shopping: { color: '#E89571', icon: ShoppingBag, chipBg: '#FCE8DC', chipText: '#A24F2E', iconColor: 'white', label: '쇼핑·기념품' },
  leisure: { color: '#FAEED4', icon: Coffee, chipBg: '#FBF4E0', chipText: '#85510B', iconColor: '#85510B', label: '자유시간' },
  tip: { color: '#8B8B95', icon: Lightbulb, chipBg: '#EBEBED', chipText: '#5A5A60', iconColor: 'white', label: '여행 팁' },
} as const

const PERSONA_LABEL: Record<Persona, string> = {
  mixed: '가족·연인',
  couple: '커플',
  'with-parents': '부모님 동행',
  'with-kids': '아이 동반',
}

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
  const heroCityLabel = master?.cityNameKo ?? product.primaryDestination ?? ''

  const updatePax = (key: keyof typeof pax, delta: number) => {
    setPax((prev) => {
      if (key === 'adult') return { ...prev, adult: Math.max(1, prev.adult + delta) }
      return { ...prev, [key]: Math.max(0, prev[key] + delta) }
    })
  }

  const adultPriceUnit = priceInfo?.lowestAdultPrice ?? 0
  const infantPriceUnit = priceInfo?.infantPrice ?? 0

  const totalQuote = useMemo(() => {
    if (!priceInfo) return null
    return (
      pax.adult * adultPriceUnit +
      pax.childBed * adultPriceUnit +
      pax.infant * infantPriceUnit
    )
  }, [pax, priceInfo, adultPriceUnit, infantPriceUnit])

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

  const selectedPriceRow = useMemo(() => {
    if (!prices?.length || !selectedDate) return null
    return pickBookableRowForDateKey(prices, selectedDate) ?? prices.find((p) => String(p.date).slice(0, 10) === selectedDate) ?? null
  }, [prices, selectedDate])

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

  const reservationLine = useMemo(() => {
    if (!travelCoreInfo) return null
    const base = travelCoreInfo.departureConditionLine?.trim() || ''
    const seats = selectedPriceRow?.availableSeats
    const bits: string[] = []
    if (base) bits.push(base)
    if (seats != null && seats >= 0) bits.push(`여유좌석 약 ${seats}석`)
    return bits.length ? bits.join(' · ') : null
  }, [travelCoreInfo, selectedPriceRow])

  const periodContent = useMemo(() => {
    const depIso = selectedDate ?? priceInfo?.departureDateFrom ?? null
    const heroDepartureDisplay = formatHeroDateKorean(depIso) ?? depIso
    const duration = travelCoreInfo?.duration?.trim() || product.duration?.trim() || ''
    return (
      <>
        <span className={HERO_DATE_INLINE_VALUE_CLASS}>{heroDepartureDisplay ?? '—'}</span>
        <span className="text-bt-disabled"> ~ </span>
        <span className={HERO_DATE_INLINE_VALUE_CLASS}>
          {computedReturnDate ? computedReturnDate : '상담 시 안내'}
        </span>
        {duration ? (
          <>
            {' '}
            <span className="font-extrabold text-bt-card-accent-strong">{duration}</span>
          </>
        ) : null}
      </>
    )
  }, [
    selectedDate,
    priceInfo?.departureDateFrom,
    computedReturnDate,
    travelCoreInfo?.duration,
    product.duration,
  ])

  const ctaLabel =
    mode === 'example'
      ? '자유여행 상담 신청'
      : mode === 'confirmed'
        ? '우리끼리 문의'
        : '예약 요청 접수'

  const ctaHref = `/inquiry?type=travel&productId=${product.id}`
  const supplierDisplayLabel = product.originSource
    ? formatOriginSourceForDisplay(product.originSource)
    : ''

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
    <div className="bg-[#FAFAFC] min-h-screen font-sans pb-24 lg:pb-0">
      {/* HERO */}
      <section
        className="relative w-full overflow-hidden"
        style={{ height: '70vh', minHeight: '520px', maxHeight: '720px' }}
      >
        <div
          className="absolute inset-0 z-[1]"
          style={{ filter: 'brightness(1.06) contrast(1.12) saturate(1.20)' }}
        >
          <ProductHeroCarousel
            heroUrl={product.bgImageUrl}
            daySlides={daySlidesData}
            productTitle={product.title}
            heroImagePhotographer={product.bgImagePhotographer ?? null}
            heroImageSourceType={product.bgImageSource ?? null}
            heroImageIsGenerated={product.bgImageIsGenerated ?? null}
            heroImageSeoKeywordOverlay={product.heroImageSeoKeywordOverlay ?? null}
            primaryDestination={product.primaryDestination ?? null}
            destination={product.primaryDestination ?? null}
            fillParent
            className="absolute inset-0 h-full w-full rounded-none border-0 shadow-none"
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-[10]"
          style={{ background: 'linear-gradient(to top, rgba(31,27,45,0.75) 0%, rgba(31,27,45,0.30) 35%, rgba(31,27,45,0.10) 60%, transparent 80%)' }}
          aria-hidden
        />

        {product.heroImageSeoKeywordOverlay && (
          <div className="absolute top-3 left-3 lg:left-4 z-[35] pointer-events-none">
            <span className="inline-flex items-center gap-1 rounded-md bg-white/15 backdrop-blur-sm border border-white/25 px-2.5 py-1 text-[11px] font-medium text-white">
              {product.heroImageSeoKeywordOverlay}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-[30] pointer-events-none">
          <div className="max-w-7xl mx-auto w-full px-6 pb-16 lg:px-8 lg:pb-20 text-white pr-40 lg:pr-48">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 mb-3 pointer-events-auto">
              {mode === 'example' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#d9a81e] px-3 py-1 text-xs font-bold text-[#1F1B2D] shadow-md">
                  ✦ 예시 일정
                </span>
              )}
              {product.originSource && supplierDisplayLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {supplierDisplayLabel}
                </span>
              ) : null}
              <div className="text-base md:text-lg text-white font-semibold tracking-wide">
                자유여행 · 에어텔 · {heroCityLabel}
              </div>
            </div>
            <ProductHeroTitleLines
              title={product.title}
              className="mb-6 text-2xl font-black leading-[1.52] text-white md:text-4xl md:leading-[1.5] lg:text-5xl"
              style={{ textShadow: '0 2px 12px rgba(31,27,45,0.6)' }}
            />
            <Link
              href={ctaHref}
              className="pointer-events-auto inline-flex items-center gap-2 bg-[#d9a81e] hover:bg-[#c89619] text-[#1F1B2D] font-bold px-6 py-3 rounded-full text-sm transition shadow-lg"
            >
              {ctaLabel}
              <span aria-hidden>↗</span>
            </Link>
            </div>
          </div>
        </div>
      </section>

      {travelCoreInfo ? (
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-8 space-y-8">
          <div className="rounded-2xl border border-[#DAD4EE] bg-white px-2 py-2 sm:px-4">
            <TravelCoreInfoSection
              facts={selectedDepartureFacts}
              productAirline={travelCoreInfo.productAirline}
              periodContent={periodContent}
              travelCitiesLine={travelCoreInfo.travelCitiesLine}
              reservationLine={reservationLine}
              meetingDefault={travelCoreInfo.meetingDefault}
              meetingExtra={null}
              metaChips={travelCoreInfo.productMetaChips}
              flightExposurePolicy={travelCoreInfo.flightExposurePolicy ?? null}
            />
          </div>
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
                  const hotelLine = formatScheduleDayHotelLine({
                    hotelNames: product.hotelNames ?? null,
                    hotelSummaryText: product.hotelSummaryText ?? null,
                    dayHotelText: day.hotelText ?? null,
                  })
                  const mealLines = formatMealDisplay({
                    breakfastText: day.breakfastText,
                    lunchText: day.lunchText,
                    dinnerText: day.dinnerText,
                    mealSummaryText: day.mealSummaryText,
                    mealsLegacy: day.meals ?? null,
                  })
                  const mealLine = mealLines.length > 0 ? mealLines.join(', ') : null
                  const hotelCat = CATEGORY.hotel
                  const mealCat = CATEGORY.meal
                  const HotelIcon = hotelCat.icon
                  const MealIcon = mealCat.icon
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
                      <div className="space-y-3">
                        {day.description ? (
                          <article className="flex gap-3 rounded-2xl bg-white border border-[#DAD4EE] p-4">
                            <div className="rounded-xl bg-[#1F1B2D] text-white w-12 h-12 flex items-center justify-center text-xl shrink-0">
                              📋
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="inline-block rounded-full bg-[#EFEDF8] px-2.5 py-0.5 text-xs font-semibold fit-tx-primary mb-2">
                                일정 요약
                              </span>
                              <p className="text-sm fit-tx-primary whitespace-pre-line leading-relaxed">
                                {day.description}
                              </p>
                            </div>
                          </article>
                        ) : null}
                        {hotelLine ? (
                          <article className="flex gap-3 rounded-2xl bg-white border border-[#DAD4EE] p-4">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: hotelCat.color }}
                            >
                              <HotelIcon size={20} color={hotelCat.iconColor} strokeWidth={1.8} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span
                                className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mb-2 tracking-wide"
                                style={{ background: hotelCat.chipBg, color: hotelCat.chipText }}
                              >
                                {hotelCat.label}
                              </span>
                              <p className="text-sm fit-tx-primary leading-relaxed">{hotelLine}</p>
                            </div>
                          </article>
                        ) : null}
                        {mealLine ? (
                          <article className="flex gap-3 rounded-2xl bg-white border border-[#DAD4EE] p-4">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: mealCat.color }}
                            >
                              <MealIcon size={20} color={mealCat.iconColor} strokeWidth={1.8} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span
                                className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mb-2 tracking-wide"
                                style={{ background: mealCat.chipBg, color: mealCat.chipText }}
                              >
                                {mealCat.label}
                              </span>
                              <p className="text-sm fit-tx-primary leading-relaxed">{mealLine}</p>
                            </div>
                          </article>
                        ) : null}
                      </div>
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
          <div className="bg-white border-2 border-[#DAD4EE] shadow-md rounded-xl p-6">
            <h2 className="mb-1 border-l-4 border-[#1F1B2D] pl-3 text-base font-black tracking-tight fit-tx-primary">
              실시간 견적
            </h2>

            {priceInfo && (
              <div className="mt-3 rounded-xl border border-[#DAD4EE] bg-[#FAFAFC] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide fit-tx-meta">선택 일정</p>
                <div className="mt-2 space-y-1">
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="fit-tx-meta">출발일</span>
                    <span className="font-semibold tabular-nums fit-tx-primary">{selectedDate ?? priceInfo.departureDateFrom} ~</span>
                  </p>
                  <p className="text-center text-[11px] font-semibold fit-tx-gold">일정 상태: 예약 가능</p>
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="fit-tx-meta">귀국일</span>
                    <span className="font-semibold tabular-nums fit-tx-primary">
                      {computedReturnDate ? computedReturnDate : '상담 시 안내'}
                    </span>
                  </p>
                </div>
                {product.minimumDepartureCount != null && product.minimumDepartureCount > 1 && (
                  <p className="mt-1 text-[11px] fit-tx-meta">
                    최소 출발 {product.minimumDepartureCount}명
                  </p>
                )}
                <p className="mt-1 text-[10px] fit-tx-meta">참고 최저가 ₩{priceInfo.lowestAdultPrice.toLocaleString()}</p>
              </div>
            )}

            {priceInfo && (
              <div className="mt-3 rounded-xl border border-[#DAD4EE] bg-[#FAFAFC] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide fit-tx-meta">가격</p>
                <div className="mt-2 flex flex-col gap-2">
                  <span className="inline-flex items-baseline gap-1 tabular-nums">
                    <span className="text-[0.85em] font-bold fit-tx-meta">₩</span>
                    <span className="text-3xl font-extrabold tracking-tight fit-tx-price">
                      {priceInfo.lowestAdultPrice.toLocaleString('ko-KR')}
                    </span>
                  </span>
                  <p className="text-[11px] fit-tx-meta">1인 기준 표시 가격입니다.</p>
                </div>
                {totalQuote != null && totalQuote > 0 && (
                  <p className="mt-1.5 flex flex-wrap items-baseline gap-1 text-[11px] fit-tx-meta">
                    <span>선택 인원 견적 합계</span>
                    <span className="inline-flex items-baseline gap-0.5 font-semibold tabular-nums fit-tx-primary">
                      <span className="text-[0.85em]">₩</span>
                      <span>{totalQuote.toLocaleString('ko-KR')}</span>
                    </span>
                  </p>
                )}
              </div>
            )}

            <p className="mt-3 rounded-xl border border-[#DAD4EE] bg-white px-3 py-2 text-[11px] leading-relaxed fit-tx-meta">
              <span className="font-semibold fit-tx-primary">카드사별 무이자 혜택 가능</span> · 카드사별 무이자 혜택은 결제 시점 기준으로 적용됩니다.
            </p>

            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-3 w-full px-4 py-3 rounded-xl bg-[#1F1B2D] text-white text-sm font-semibold hover:bg-[#2C2840] transition"
            >
              출발일 변경
            </button>

            <div className="mt-4 border-t border-[#DAD4EE] pt-3">
              <p className="text-xs fit-tx-meta">인원·옵션: 상담 시 안내</p>
            </div>

            <div className="mt-4 border-t border-[#DAD4EE] pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide fit-tx-primary">인원</p>
              <div className="space-y-2.5">
                {[
                  { key: 'adult' as const, label: '성인', ageLine: '만 12세 이상', minVal: 1 },
                  { key: 'childBed' as const, label: '아동', ageLine: '만 2~11세', minVal: 0 },
                  { key: 'infant' as const, label: '유아', ageLine: '만 2세 미만', minVal: 0 },
                ].map((row) => {
                  const unit = row.key === 'infant' ? infantPriceUnit : adultPriceUnit
                  const count = pax[row.key]
                  const atMin = count <= row.minVal
                  return (
                    <div key={row.key} className="flex items-center justify-between rounded-xl border border-[#DAD4EE] bg-[#FAFAFC] px-3 py-2.5">
                      <div>
                        <div className="text-sm font-semibold fit-tx-primary">{row.label}</div>
                        <div className="text-[10px] fit-tx-meta">{row.ageLine}</div>
                        {unit > 0 && (
                          <div className="mt-0.5 text-xs font-semibold fit-tx-price tabular-nums">₩{unit.toLocaleString()} /인</div>
                        )}
                      </div>
                      <div className="grid h-9 w-[7rem] grid-cols-[2rem_1fr_2rem] items-center gap-1">
                        <button type="button" onClick={() => updatePax(row.key, -1)} disabled={atMin} className={PAX_STEP_BUTTON_CLASS + ' h-9 w-9 text-base'}>−</button>
                        <span className="text-center text-base font-bold tabular-nums fit-tx-primary">{count}</span>
                        <button type="button" onClick={() => updatePax(row.key, 1)} className={PAX_STEP_BUTTON_CLASS + ' h-9 w-9 text-base'}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-[10px] fit-tx-meta leading-relaxed">
                ※ 아동 요금은 성인과 동일. 유아는 좌석 미배정 별도 요금.
              </p>
            </div>

            <KakaoCounselCta
              variant="kakaoSoft"
              intent="departure"
              fromScreen="fit-itinerary"
              productId={String(product.id)}
              listingProductNumber={product.originCode}
              productTitle={product.title}
              originSource={product.originSource}
              originCode={product.originCode}
              selectedDepartureDate={selectedDate}
              selectedDepartureId={null}
              preferredDepartureDate={null}
              pax={{ adult: pax.adult, childBed: pax.childBed, childNoBed: 0, infant: pax.infant }}
              quotationKrwTotal={totalQuote}
              localFeePerPerson={null}
              localFeeCurrency={null}
              advisoryLabel={null}
              pricingMode="lowest"
              isCollectingPrices={false}
              className="mt-4 w-full"
            />
            <p className="mt-1.5 text-center text-[10px] fit-tx-meta">
              상품·인원·출발일 요약을 카카오톡 채널로 전달합니다.
            </p>

            <ShareActions
              title={master?.title ?? product.title}
              summaryLine={`${product.title} · ${selectedDate ?? priceInfo?.departureDateFrom ?? ''} 출발 · ₩{(priceInfo?.lowestAdultPrice ?? 0).toLocaleString()}부터`}
              className="mt-3"
            />

            <Link
              href={ctaHref}
              className="mt-3 block w-full text-center bg-[#d9a81e] fit-tx-primary px-4 py-4 rounded-xl text-base font-bold hover:bg-[#c79a1c] transition"
            >
              {ctaLabel} →
            </Link>

            <p className="mt-3 text-[10px] leading-relaxed fit-tx-meta text-center">
              ※ 표시 가격은 출발일·시즌별 최저가 기준.<br />실제 결제 가격은 상담 시 확정됩니다.
            </p>
          </div>
        </aside>
      </main>

      {/* 모바일 floating CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#DAD4EE] px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-bold fit-tx-primary">
              {priceInfo ? `₩{priceInfo.lowestAdultPrice.toLocaleString()}~` : product.title}
            </div>
            <div className="text-xs fit-tx-meta">
              {master
                ? `${master.totalDays - 1}박${master.totalDays}일 · ${PERSONA_LABEL[master.persona]}`
                : '예시 일정 · 상담 시 확정'}
            </div>
          </div>
          <a href={ctaHref} className="bg-[#d9a81e] fit-tx-primary px-5 py-2.5 rounded-full text-xs font-medium whitespace-nowrap">
            {ctaLabel} →
          </a>
        </div>
      </div>

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
