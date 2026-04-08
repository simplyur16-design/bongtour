/**
 * 항공 leg "깨짐" 판정 — 병합(departure-key-facts)·표시(flight-user-display) 공통.
 * UI 전용 포맷터에 의존하지 않는 순수 predicate.
 */

function airportTokenLooksLikeNumericGarbage(s: string | null | undefined): boolean {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (/^\d{1,3}$/.test(t)) return true
  return false
}

function datetimeTextLooksLikeYearOnly(s: string | null | undefined): boolean {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length === 4 && /^\d{4}$/.test(t)
}

export function legHasGarbageFlightFields(leg: {
  departureAirport?: string | null
  arrivalAirport?: string | null
  departureAtText?: string | null
  arrivalAtText?: string | null
}): boolean {
  if (airportTokenLooksLikeNumericGarbage(leg.departureAirport) || airportTokenLooksLikeNumericGarbage(leg.arrivalAirport))
    return true
  if (datetimeTextLooksLikeYearOnly(leg.departureAtText) || datetimeTextLooksLikeYearOnly(leg.arrivalAtText)) return true
  return false
}
