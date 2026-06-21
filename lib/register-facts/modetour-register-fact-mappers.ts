/**
 * modetour register-facts — schedule·flight 순수 매퍼 (DB·fetch 의존 없음, vitest CI용).
 *
 * REGRESSION-FREEZE[register-facts-foundation]: modetourScheduleItemsToFactDays — manifest
 */
import type { RegisterFactFlightLeg, RegisterFactScheduleDay } from '@/lib/register-facts/types'

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
    departureFlight?: string | null
  }>
}

function ymdFromIso(raw: string | null | undefined): string | null {
  const m = String(raw ?? '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? null
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
      const t = String(p).trim()
      if (t && !row.places.includes(t)) row.places.push(t)
    }
    const hotel = String(item.scheduleHotel ?? '').trim()
    if (hotel && !row.hotels.includes(hotel)) row.hotels.push(hotel)

    for (const act of item.ortherActions ?? []) {
      const svc = String(act.itiServiceName ?? '').trim()
      const place = String(act.itiPlaceName ?? '').trim()
      const summary = String(act.itiSummaryDes ?? '').trim()
      if (/식사|조식|중식|석식/.test(svc) && summary && !row.meals.includes(summary)) {
        row.meals.push(summary)
      } else if (place && !row.places.includes(place)) {
        row.places.push(place)
      }
      if (/이동|항공|국제선|국내선/.test(svc) && summary) {
        row.transportNote = row.transportNote ? `${row.transportNote}; ${summary}` : summary
      }
    }
    byDay.set(day, row)
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day)
}

export function modetourFlightRoutesToFactLegs(routes: ModetourFlightRouteItem[]): RegisterFactFlightLeg[] {
  const legs: RegisterFactFlightLeg[] = []
  for (const route of routes) {
    const dirRaw = String(route.flightTypeName ?? '').toUpperCase()
    const direction: RegisterFactFlightLeg['direction'] =
      dirRaw.includes('DEPART') ? 'outbound' : dirRaw.includes('RETURN') ? 'inbound' : 'unknown'
    for (const item of route.item ?? []) {
      const depDate = ymdFromIso(item.departureDate)
      const depTime = String(item.departureTime ?? '').trim()
      const arrDate = ymdFromIso(item.arrivalDate)
      legs.push({
        direction,
        carrier: item.transportName?.trim() || null,
        flightNo: item.departureFlight?.trim() || null,
        departureCity: item.departureCityName?.trim() || null,
        departureAt: depDate && depTime ? `${depDate}T${depTime}` : depDate,
        arrivalCity: item.arrivalCityName?.trim() || null,
        arrivalAt: arrDate,
      })
    }
  }
  return legs
}
