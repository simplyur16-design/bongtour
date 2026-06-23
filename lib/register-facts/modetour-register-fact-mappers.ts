/**
 * modetour register-facts — schedule·flight 순수 매퍼 (DB·fetch 의존 없음, vitest CI용).
 *
 * REGRESSION-FREEZE[register-facts-foundation]: modetourScheduleItemsToFactDays — manifest
 */
import type { RegisterFactFlightLeg, RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { FlightStructured } from '@/lib/detail-body-parser-types'

export type ModetourScheduleItem = {
  first?: number
  placeHeader?: string[]
  scheduleHotel?: string | null
  ortherActions?: Array<{
    itiDays?: number
    itiServiceName?: string | null
    itiPlaceName?: string | null
    itiSummaryDes?: string | null
  }>
}

export type ModetourFlightRouteItem = {
  flightTypeName?: string | null
  item?: Array<{
    transportName?: string | null
    departureCityName?: string | null
    departureDate?: string | null
    departureTime?: string | null
    arrivalCityName?: string | null
    arrivalDate?: string | null
    arrivalTime?: string | null
    departureFlight?: string | null
  }>
}

function modetourRouteDirection(flightTypeName: string | null | undefined): RegisterFactFlightLeg['direction'] {
  const dirRaw = String(flightTypeName ?? '').toUpperCase()
  if (dirRaw.includes('DEPART')) return 'outbound'
  if (dirRaw.includes('RETURN') || dirRaw.includes('ARRIVAL')) return 'inbound'
  return 'unknown'
}

function modetourMergeRouteItemsToLeg(
  direction: RegisterFactFlightLeg['direction'],
  items: NonNullable<ModetourFlightRouteItem['item']>,
): RegisterFactFlightLeg | null {
  let departureCity: string | null = null
  let departureAt: string | null = null
  let arrivalCity: string | null = null
  let arrivalAt: string | null = null
  let carrier: string | null = null
  let flightNo: string | null = null

  for (const item of items) {
    const depDate = ymdFromIso(item.departureDate)
    const depTime = String(item.departureTime ?? '').trim()
    const arrDate = ymdFromIso(item.arrivalDate)
    const arrTime = String(item.arrivalTime ?? '').trim()
    if (item.departureCityName?.trim()) departureCity = item.departureCityName.trim()
    if (depDate) departureAt = depDate && depTime ? `${depDate}T${depTime}` : depDate
    if (item.arrivalCityName?.trim()) arrivalCity = item.arrivalCityName.trim()
    if (arrDate) arrivalAt = arrDate && arrTime ? `${arrDate}T${arrTime}` : arrDate
    if (item.transportName?.trim()) carrier = item.transportName.trim()
    if (item.departureFlight?.trim()) flightNo = item.departureFlight.trim()
  }

  if (!departureCity && !arrivalCity && !flightNo && !departureAt) return null
  return {
    direction,
    carrier,
    flightNo,
    departureCity,
    departureAt,
    arrivalCity,
    arrivalAt,
  }
}

export function modetourFlightRoutesToFactLegs(routes: ModetourFlightRouteItem[]): RegisterFactFlightLeg[] {
  const legs: RegisterFactFlightLeg[] = []
  for (const route of routes) {
    const direction = modetourRouteDirection(route.flightTypeName)
    const merged = modetourMergeRouteItemsToLeg(direction, route.item ?? [])
    if (merged) legs.push(merged)
  }
  return legs
}

function ymdFromIso(raw: string | null | undefined): string | null {
  const m = String(raw ?? '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? null
}

function modetourStripHtmlFromText(s: string): string {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MODETOUR_PREP_PLACE_RE =
  /출발\s*전\s*준비|준비\s*사항|변동이\s*있을\s*경우|출발\s*\d+\s*시간\s*전|수하물|탑승권|연결\s*수속|홈페이지|알림톡/i

function isModetourPrepOrNoticePlace(name: string): boolean {
  return MODETOUR_PREP_PLACE_RE.test(name) || name.length > 56
}

export function modetourScheduleItemsToFactDays(items: ModetourScheduleItem[]): RegisterFactScheduleDay[] {
  const byDay = new Map<number, RegisterFactScheduleDay>()
  for (const item of items) {
    const day = Number(item.first ?? 0)
    if (!Number.isFinite(day) || day <= 0) continue
    const row =
      byDay.get(day) ??
      ({
        day,
        places: [],
        hotels: [],
        meals: [],
        transportNote: null,
      } satisfies RegisterFactScheduleDay)

    for (const p of item.placeHeader ?? []) {
      const t = modetourStripHtmlFromText(String(p))
      if (t && !row.places.includes(t) && !isModetourPrepOrNoticePlace(t)) row.places.push(t)
    }
    const hotel = modetourStripHtmlFromText(String(item.scheduleHotel ?? ''))
    if (hotel && !row.hotels.includes(hotel)) row.hotels.push(hotel)

    for (const act of item.ortherActions ?? []) {
      const svc = modetourStripHtmlFromText(String(act.itiServiceName ?? ''))
      const place = modetourStripHtmlFromText(String(act.itiPlaceName ?? ''))
      const summary = modetourStripHtmlFromText(String(act.itiSummaryDes ?? ''))
      if (/숙박|호텔|숙소|리조트/i.test(svc) && summary && !row.hotels.includes(summary)) {
        row.hotels.push(summary)
      } else if (/식사|조식|중식|석식|기내식/.test(svc) || /조식|중식|석식|기내식|호텔식|현지식/.test(summary)) {
        const mealLine = summary || svc
        if (mealLine && !row.meals.includes(mealLine)) row.meals.push(mealLine)
      } else if (place && !isModetourPrepOrNoticePlace(place) && !row.places.includes(place)) {
        row.places.push(place)
      } else if (place && isModetourPrepOrNoticePlace(place) && summary) {
        row.transportNote = row.transportNote ? `${row.transportNote}; ${summary}` : summary
      } else if (/관광|체험|투어/i.test(svc) && place && !isModetourPrepOrNoticePlace(place) && !row.places.includes(place)) {
        row.places.push(place)
      }
      if (/이동|항공|국제선|국내선|보트|스피드/i.test(svc) && summary) {
        row.transportNote = row.transportNote ? `${row.transportNote}; ${summary}` : summary
      } else if (summary && isModetourPrepOrNoticePlace(place || summary)) {
        row.transportNote = row.transportNote ? `${row.transportNote}; ${summary}` : summary
      }
    }
    byDay.set(day, row)
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day)
}

function factLegToFlightLeg(leg: RegisterFactFlightLeg): FlightStructured['outbound'] {
  const depAt = String(leg.departureAt ?? '')
  const [depDate, depTimeRaw] = depAt.includes('T') ? depAt.split('T') : [depAt, null]
  const depTime = depTimeRaw ? depTimeRaw.slice(0, 5) : null
  const arrAt = String(leg.arrivalAt ?? '')
  const [arrDate, arrTimeRaw] = arrAt.includes('T') ? arrAt.split('T') : [arrAt, null]
  const arrTime = arrTimeRaw ? arrTimeRaw.slice(0, 5) : null
  return {
    departureAirport: leg.departureCity?.trim() || null,
    departureAirportCode: null,
    departureDate: depDate || null,
    departureTime: depTime,
    arrivalAirport: leg.arrivalCity?.trim() || null,
    arrivalAirportCode: null,
    arrivalDate: arrDate || null,
    arrivalTime: arrTime,
    flightNo: leg.flightNo?.trim() || null,
    durationText: null,
  }
}

/** ItineraryDlgFlightRoute → 등록 flightStructured (REGRESSION-FREEZE[register-detail-collect-flight-apply]) */
export function buildModetourFlightStructuredFromRoutes(
  routes: ModetourFlightRouteItem[],
): FlightStructured | null {
  const legs = modetourFlightRoutesToFactLegs(routes)
  const obLeg = legs.find((l) => l.direction === 'outbound')
  const ibLeg = legs.find((l) => l.direction === 'inbound')
  if (!obLeg && !ibLeg) return null
  const emptyLeg = (): FlightStructured['outbound'] => ({
    departureAirport: null,
    departureAirportCode: null,
    departureDate: null,
    departureTime: null,
    arrivalAirport: null,
    arrivalAirportCode: null,
    arrivalDate: null,
    arrivalTime: null,
    flightNo: null,
    durationText: null,
  })
  const outbound = obLeg ? factLegToFlightLeg(obLeg) : emptyLeg()
  const inbound = ibLeg ? factLegToFlightLeg(ibLeg) : emptyLeg()
  const airlineName = obLeg?.carrier?.trim() || ibLeg?.carrier?.trim() || null
  const hasOb = Boolean(outbound.flightNo || outbound.departureTime)
  const hasIb = Boolean(inbound.flightNo || inbound.departureTime)
  if (!hasOb && !hasIb) return null
  return {
    airlineName,
    outbound,
    inbound,
    rawFlightLines: [],
    debug: {
      candidateCount: routes.length,
      selectedOutRaw: outbound.flightNo,
      selectedInRaw: inbound.flightNo,
      partialStructured: !(hasOb && hasIb && airlineName),
      status: hasOb && hasIb && airlineName ? 'success' : 'partial',
      exposurePolicy: 'public_full',
      supplierBrandKey: 'modetour',
      expectFlightNumber: true,
    },
    reviewNeeded: false,
    reviewReasons: [],
  }
}
