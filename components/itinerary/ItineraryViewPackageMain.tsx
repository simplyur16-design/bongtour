'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { TravelProduct, ScheduleDay } from '@/app/components/travel/TravelProductDetail'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import type { ProductMetaChip } from '@/lib/product-meta-chips'
import ProductHighlightPointsSection from '@/app/components/detail/ProductHighlightPointsSection'
import EsimProductDetailCrossSell from '@/app/components/travel/EsimProductDetailCrossSell'
import MustKnowEssentialsSection from '@/app/components/travel/MustKnowEssentialsSection'
import { filterPublicMustKnowItemsForTripReadiness } from '@/lib/public-must-know-display'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'
import { formatScheduleDayHotelLine, formatMealDisplay } from '@/lib/hotel-meal-display'
import { ItineraryExtraInfoBoxes } from '@/components/itinerary/ItineraryExtraInfoBoxes'
import { Bed, UtensilsCrossed } from 'lucide-react'
import type { FlightStructuredBody } from '@/lib/public-product-extras'

function airportLabel(airport: string | null | undefined, code: string | null | undefined) {
  return airport?.trim() || code?.trim() || ''
}

function datetimeLabel(date: string | null | undefined, time: string | null | undefined) {
  return [date, time].filter((x) => x && String(x).trim()).join(' ')
}

function resolvePackageFlightDisplay(flightStructured: FlightStructuredBody | null | undefined) {
  const persisted = flightStructured?.modetourPersistedFlightStructured
  if (!persisted) return null
  const outbound = persisted.outbound
  const inbound = persisted.inbound
  const out =
    outbound &&
    (airportLabel(outbound.departureAirport, outbound.departureAirportCode) ||
      airportLabel(outbound.arrivalAirport, outbound.arrivalAirportCode) ||
      datetimeLabel(outbound.departureDate, outbound.departureTime))
      ? {
          from: airportLabel(outbound.departureAirport, outbound.departureAirportCode),
          to: airportLabel(outbound.arrivalAirport, outbound.arrivalAirportCode),
          departureAt: datetimeLabel(outbound.departureDate, outbound.departureTime),
          arrivalAt: datetimeLabel(outbound.arrivalDate, outbound.arrivalTime),
        }
      : null
  const inn =
    inbound &&
    (airportLabel(inbound.departureAirport, inbound.departureAirportCode) ||
      airportLabel(inbound.arrivalAirport, inbound.arrivalAirportCode) ||
      datetimeLabel(inbound.departureDate, inbound.departureTime))
      ? {
          from: airportLabel(inbound.departureAirport, inbound.departureAirportCode),
          to: airportLabel(inbound.arrivalAirport, inbound.arrivalAirportCode),
          departureAt: datetimeLabel(inbound.departureDate, inbound.departureTime),
          arrivalAt: datetimeLabel(inbound.arrivalDate, inbound.arrivalTime),
        }
      : null
  if (!out && !inn) return null
  return { outbound: out, inbound: inn }
}

const CATEGORY = {
  hotel: { color: '#C9C2E3', icon: Bed, chipBg: '#EFEDF8', chipText: '#534AB7', iconColor: '#534AB7', label: '숙소' },
  meal: { color: '#d9a81e', icon: UtensilsCrossed, chipBg: '#FAEEDA', chipText: '#85510B', iconColor: 'white', label: '식사' },
} as const

type Props = {
  product: TravelProduct
  selectedDepartureFacts: DepartureKeyFacts | null
  periodContent: React.ReactNode
  travelCitiesLine: string
  reservationLine: string | null
  meetingDefault: string
  productMetaChips: ProductMetaChip[]
  omitBriefRows?: boolean
  showEsimCrossSell?: boolean
}

export function ItineraryViewPackageMain({
  product,
  showEsimCrossSell = false,
}: Props) {
  const schedule = product.schedule ?? []
  const pageSize = 2
  const totalDays = schedule.length
  const pageCount = totalDays > 0 ? Math.ceil(totalDays / pageSize) : 0
  const [activePage, setActivePage] = useState<number | 'all'>(1)

  const mustKnowFiltered = useMemo(
    () =>
      filterPublicMustKnowItemsForTripReadiness(
        product.mustKnowItems ?? [],
        normalizeSupplierOrigin(product.originSource) === 'hanatour' ? 10 : 6,
        product.originSource
      ),
    [product.mustKnowItems, product.originSource]
  )

  const flightDisplay = useMemo(
    () => resolvePackageFlightDisplay(product.flightStructured),
    [product.flightStructured]
  )

  const isAirHotelFree = isAirHotelFreeListingForUi(product.listingKind)

  const extraProduct = useMemo(
    () => ({
      productType: product.productType,
      listingKind: product.listingKind ?? null,
      includedText: product.includedText,
      excludedText: product.excludedText,
      optionalToursStructured: product.optionalToursStructured,
      optionalToursPasteRaw: product.optionalToursPasteRaw ?? null,
      shoppingCount: product.shoppingCount ?? product.shoppingVisitCountTotal ?? null,
      shoppingItems: product.shoppingItems,
      shoppingCautionNoticeRaw: product.shoppingNoticeRaw,
      shoppingStopsStructured: product.shoppingStopsStructured ?? null,
      reservationNoticeRaw: product.reservationNoticeRaw,
    }),
    [product]
  )

  const visibleSchedule = useMemo(() => {
    if (activePage === 'all' || pageCount === 0) return schedule
    const startDay = (activePage - 1) * pageSize + 1
    const endDay = Math.min(startDay + pageSize - 1, totalDays)
    return schedule.filter((d) => {
      const n = Number(d.day)
      return n >= startDay && n <= endDay
    })
  }, [schedule, activePage, pageCount, pageSize, totalDays])

  return (
    <div className="space-y-10 min-w-0">
      <ItineraryExtraInfoBoxes product={extraProduct} section="top" />

      {totalDays > 0 ? (
        <div className="sticky top-[72px] sm:top-20 z-10 -mx-1 bg-[#FAFAFC]/95 backdrop-blur-sm border-b border-[#DAD4EE] py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-sm text-[#888780] font-medium whitespace-nowrap mr-2">전체 {totalDays}일</span>
            {Array.from({ length: pageCount }, (_, i) => {
              const pageNum = i + 1
              const startDay = i * pageSize + 1
              const endDay = Math.min(startDay + pageSize - 1, totalDays)
              const label = startDay === endDay ? `Day ${startDay}` : `Day ${startDay}-${endDay}`
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setActivePage(pageNum)}
                  className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition ${
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
              type="button"
              onClick={() => setActivePage('all')}
              className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition ${
                activePage === 'all' ? 'bg-[#d9a81e] fit-tx-primary font-bold' : 'bg-[#FAEED4] fit-tx-price hover:bg-[#F5E5B8] font-semibold'
              }`}
            >
              전체 일정 펼치기
            </button>
          </div>
        </div>
      ) : null}

      <ProductHighlightPointsSection
        highlightPoints={product.highlightPoints ?? null}
        highlightPointsRaw={product.highlightPointsRaw ?? null}
      />

      {schedule.length > 0 ? (
        <section className="space-y-8">
          <h2 className="border-l-4 border-[#1F1B2D] pl-3 text-lg md:text-xl font-black tracking-tight fit-tx-primary">
            일정
          </h2>
          {isAirHotelFree ? (
            <p className="bt-wrap rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-center text-sm font-semibold text-amber-950">
              아래보시는 일정은 예시 일정입니다.
            </p>
          ) : null}
          {visibleSchedule.map((day, idx) => {
            const sd = day as ScheduleDay
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
            const mealLine = mealLines.length > 0 ? mealLines.join(', ') : null
            const hotelCat = CATEGORY.hotel
            const mealCat = CATEGORY.meal
            const HotelIcon = hotelCat.icon
            const MealIcon = mealCat.icon

            return (
              <section key={`${day.day}-${idx}`} className="space-y-4 scroll-mt-28">
                <div className="border-b border-[#DAD4EE] pb-4">
                  <p className="text-xs font-bold tracking-widest fit-tx-gold mb-1">DAY {day.day}</p>
                  <h3 className="text-2xl md:text-3xl font-black fit-tx-primary mb-2">
                    {sd.title || `Day ${day.day}`}
                  </h3>
                </div>
                <div className="space-y-3">
                  {sd.description ? (
                    <article className="flex gap-3 rounded-2xl bg-white border border-[#DAD4EE] p-4">
                      <div className="rounded-xl bg-[#1F1B2D] text-white w-12 h-12 flex items-center justify-center text-xl shrink-0">
                        📋
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="inline-block rounded-full bg-[#EFEDF8] px-2.5 py-0.5 text-xs font-semibold fit-tx-primary mb-2">
                          일정 요약
                        </span>
                        <p className="text-sm fit-tx-primary whitespace-pre-line leading-relaxed">{sd.description}</p>
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
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mb-2"
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
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mb-2"
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
        </section>
      ) : (
        <p className="text-sm fit-tx-meta">등록된 일정 요약이 없습니다.</p>
      )}

      {flightDisplay ? (
        <section>
          <h2 className="mb-3 border-l-4 border-[#1F1B2D] pl-3 text-lg md:text-xl font-black tracking-tight fit-tx-primary">
            항공편
          </h2>
          <div className="rounded-2xl bg-white border border-[#DAD4EE] px-6 py-5 space-y-3">
            {flightDisplay.outbound ? (
              <div className="flex flex-wrap items-center gap-3 text-sm fit-tx-primary">
                <span className="rounded-full bg-[#1F1B2D] text-white px-2.5 py-1 text-xs font-bold">출국</span>
                {flightDisplay.outbound.from ? <span className="font-semibold">{flightDisplay.outbound.from}</span> : null}
                {flightDisplay.outbound.departureAt ? (
                  <span className="tabular-nums">{flightDisplay.outbound.departureAt}</span>
                ) : null}
                <span className="text-[#DAD4EE]">→</span>
                {flightDisplay.outbound.to ? <span className="font-semibold">{flightDisplay.outbound.to}</span> : null}
                {flightDisplay.outbound.arrivalAt ? (
                  <span className="tabular-nums">{flightDisplay.outbound.arrivalAt}</span>
                ) : null}
              </div>
            ) : null}
            {flightDisplay.inbound ? (
              <div className="flex flex-wrap items-center gap-3 text-sm fit-tx-primary">
                <span className="rounded-full bg-[#1F1B2D] text-white px-2.5 py-1 text-xs font-bold">귀국</span>
                {flightDisplay.inbound.from ? <span className="font-semibold">{flightDisplay.inbound.from}</span> : null}
                {flightDisplay.inbound.departureAt ? (
                  <span className="tabular-nums">{flightDisplay.inbound.departureAt}</span>
                ) : null}
                <span className="text-[#DAD4EE]">→</span>
                {flightDisplay.inbound.to ? <span className="font-semibold">{flightDisplay.inbound.to}</span> : null}
                {flightDisplay.inbound.arrivalAt ? (
                  <span className="tabular-nums">{flightDisplay.inbound.arrivalAt}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <ItineraryExtraInfoBoxes product={extraProduct} section="bottom" />

      {mustKnowFiltered.length > 0 ? (
        <section>
          <h2 className="mb-3 border-l-4 border-[#1F1B2D] pl-3 text-lg md:text-xl font-black tracking-tight fit-tx-primary">
            핵심 정보
          </h2>
          <div className="rounded-2xl border border-[#DAD4EE] bg-white p-4 sm:p-6">
            <MustKnowEssentialsSection
              items={mustKnowFiltered}
              layout="desktop"
              originSource={product.originSource}
            />
          </div>
        </section>
      ) : null}

      {showEsimCrossSell ? (
        <EsimProductDetailCrossSell
          primaryDestination={product.primaryDestination ?? product.destination}
        />
      ) : null}
    </div>
  )
}
