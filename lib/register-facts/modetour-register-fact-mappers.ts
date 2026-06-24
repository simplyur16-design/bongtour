/**
 * modetour register-facts — schedule·flight 순수 매퍼 (DB·fetch 의존 없음, vitest CI용).
 *
 * REGRESSION-FREEZE[register-facts-foundation]: modetourScheduleItemsToFactDays — manifest
 * REGRESSION-FREEZE[modetour-register-taiwan-meal-shop]: listMealPlace·ortherActions·placeHeader — manifest
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
  /** B2C API 일부 응답 철자 */
  otherActions?: ModetourScheduleItem['ortherActions']
  /** GetScheduleList 일차별 조·중·석 — ortherActions와 별도 배열(SSCML1/2/3) */
  listMealPlace?: Array<{
    itiServiceName?: string | null
    itiPlaceName?: string | null
    itiSummaryDes?: string | null
    itiServiceCode?: string | null
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

const MODETOUR_MEAL_SLOT_SVC_RE = /^(?:조식|중식|석식|아침|점심|저녁)$/i
const MODETOUR_MEAL_CONTENT_RE =
  /조식|중식|석식|기내식|호텔식|현지식|특식|뷔페|식사|아침|점심|저녁|Breakfast|Lunch|Dinner/i

function modetourScheduleItemActions(item: ModetourScheduleItem): NonNullable<ModetourScheduleItem['ortherActions']> {
  return item.ortherActions ?? item.otherActions ?? []
}

/** ortherActions·placeHeader 한 줄에서 조·중·석 식사 문자열 추출 */
function modetourExtractMealLinesFromAction(svc: string, place: string, summary: string): string[] {
  const lines: string[] = []
  const push = (line: string) => {
    const t = line.replace(/\s+/g, ' ').trim()
    if (!t || lines.includes(t)) return
    lines.push(t)
  }

  if (MODETOUR_MEAL_SLOT_SVC_RE.test(svc)) {
    const content = summary || (MODETOUR_MEAL_SLOT_SVC_RE.test(place) ? '' : place)
    if (content) push(`${svc} ${content}`.trim())
    return lines
  }

  const combined = [summary, place].filter(Boolean).join(' ')
  if (/^(?:조식|중식|석식)\s*[-–—:]/i.test(place)) {
    push(place)
    return lines
  }
  if (/조식|중식|석식/.test(combined)) {
    const parts = combined
      .split(/[,，·]/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const p of parts) {
      if (/^(?:조식|중식|석식)/i.test(p)) push(p)
      else if (/호텔식|현지식|기내식|특식|뷔페|식사/.test(p)) push(p)
    }
    if (lines.length) return lines
  }

  if (/식사|기내식/i.test(svc) || MODETOUR_MEAL_CONTENT_RE.test(summary) || MODETOUR_MEAL_CONTENT_RE.test(place)) {
    if (summary) push(summary)
    else if (place && !/관광|호텔|숙박|리조트/i.test(place)) push(place)
    else if (/식사/i.test(svc)) push(svc)
  }

  return lines
}

function modetourPushMealLines(row: RegisterFactScheduleDay, mealLines: string[]): void {
  for (const mealLine of mealLines) {
    if (mealLine && !row.meals.includes(mealLine)) row.meals.push(mealLine)
  }
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
      if (!t || isModetourPrepOrNoticePlace(t)) continue
      if (MODETOUR_MEAL_CONTENT_RE.test(t) && /^(?:조식|중식|석식|식사)\b/i.test(t)) {
        modetourPushMealLines(row, modetourExtractMealLinesFromAction('식사', t, t))
        continue
      }
      if (!row.places.includes(t)) row.places.push(t)
    }
    const hotel = modetourStripHtmlFromText(String(item.scheduleHotel ?? ''))
    if (hotel && !row.hotels.includes(hotel)) row.hotels.push(hotel)

    for (const act of modetourScheduleItemActions(item)) {
      const svc = modetourStripHtmlFromText(String(act.itiServiceName ?? ''))
      const place = modetourStripHtmlFromText(String(act.itiPlaceName ?? ''))
      const summary = modetourStripHtmlFromText(String(act.itiSummaryDes ?? ''))
      const mealLines = modetourExtractMealLinesFromAction(svc, place, summary)
      if (mealLines.length > 0) {
        modetourPushMealLines(row, mealLines)
        continue
      }
      if (/숙박|호텔|숙소|리조트/i.test(svc) && summary && !row.hotels.includes(summary)) {
        row.hotels.push(summary)
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

    for (const meal of item.listMealPlace ?? []) {
      const svc = modetourStripHtmlFromText(String(meal.itiServiceName ?? ''))
      const place = modetourStripHtmlFromText(String(meal.itiPlaceName ?? ''))
      const summary = modetourStripHtmlFromText(String(meal.itiSummaryDes ?? ''))
      const mealLines = modetourExtractMealLinesFromAction(svc, place, summary)
      if (mealLines.length > 0) modetourPushMealLines(row, mealLines)
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
