/**
 * kyowontour register-facts — calendar row·미팅 → RegisterFactFlightLeg.
 *
 * REGRESSION-FREEZE[register-facts-completeness]: kyowontourCalendarRowsToRegisterFactFlights — manifest
 */
import type { KyowontourCalendarRow } from '@/lib/kyowontour-departures'
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'

export function kyowontourCalendarRowsToRegisterFactFlights(
  rows: KyowontourCalendarRow[],
  meetingText: string | null,
  preferTourCode?: string | null,
): RegisterFactFlightLeg[] {
  const prefer = String(preferTourCode ?? '').trim()
  const row =
    (prefer
      ? rows.find((r) => r.tourCode.trim() === prefer && r.airline?.trim() && r.departDate)
      : null) ??
    (prefer ? rows.find((r) => r.tourCode.trim() === prefer && r.departDate) : null) ??
    rows.find((r) => r.airline?.trim() && r.departDate) ??
    rows.find((r) => r.departDate) ??
    null
  if (!row) return []

  const carrier = row.airline?.trim() || null
  const meeting = meetingText?.trim() || null
  const legs: RegisterFactFlightLeg[] = []

  if (carrier || row.departDate) {
    legs.push({
      direction: 'outbound',
      carrier,
      flightNo: null,
      departureCity: meeting,
      departureAt: row.departDate,
      arrivalCity: null,
      arrivalAt: null,
    })
  }

  if (carrier || row.returnDate) {
    legs.push({
      direction: 'inbound',
      carrier,
      flightNo: null,
      departureCity: null,
      departureAt: row.returnDate || null,
      arrivalCity: meeting,
      arrivalAt: row.returnDate || null,
    })
  }

  return legs
}

function emptyFlightLeg(): FlightStructured['outbound'] {
  return {
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
  }
}

function factLegToStructuredLeg(leg: RegisterFactFlightLeg): FlightStructured['outbound'] {
  const depAt = String(leg.departureAt ?? '')
  const [depDate, depTimeRaw] = depAt.includes('T') ? depAt.split('T') : [depAt || null, null]
  const arrAt = String(leg.arrivalAt ?? '')
  const [arrDate, arrTimeRaw] = arrAt.includes('T') ? arrAt.split('T') : [arrAt || null, null]
  return {
    departureAirport: leg.departureCity?.trim() || null,
    departureAirportCode: null,
    departureDate: depDate || null,
    departureTime: depTimeRaw ? depTimeRaw.slice(0, 5) : null,
    arrivalAirport: leg.arrivalCity?.trim() || null,
    arrivalAirportCode: null,
    arrivalDate: arrDate || null,
    arrivalTime: arrTimeRaw ? arrTimeRaw.slice(0, 5) : null,
    flightNo: leg.flightNo?.trim() || null,
    durationText: null,
  }
}

/** prefetch 경로 — detail-collect 생략 시 bundle.flights → flightStructured */
// REGRESSION-FREEZE[register-detail-collect-flight-apply]: kyowontour facts legs → flightStructured — manifest
export function buildKyowontourFlightStructuredFromFactLegs(
  legs: readonly RegisterFactFlightLeg[] | null | undefined,
): FlightStructured | null {
  if (!legs?.length) return null
  const obLeg = legs.find((l) => l.direction === 'outbound')
  const ibLeg = legs.find((l) => l.direction === 'inbound')
  if (!obLeg && !ibLeg) return null
  const outbound = obLeg ? factLegToStructuredLeg(obLeg) : emptyFlightLeg()
  const inbound = ibLeg ? factLegToStructuredLeg(ibLeg) : emptyFlightLeg()
  const airlineName = obLeg?.carrier?.trim() || ibLeg?.carrier?.trim() || null
  const hasOb = Boolean(outbound.flightNo || outbound.departureTime || outbound.departureAirport || outbound.departureDate)
  const hasIb = Boolean(inbound.flightNo || inbound.departureTime || inbound.arrivalAirport || inbound.departureDate)
  if (!hasOb && !hasIb) return null
  return {
    airlineName,
    outbound,
    inbound,
    rawFlightLines: [],
    debug: {
      candidateCount: legs.length,
      selectedOutRaw: outbound.flightNo,
      selectedInRaw: inbound.flightNo,
      partialStructured: !(hasOb && hasIb && airlineName),
      status: hasOb && hasIb && airlineName ? 'success' : 'partial',
      exposurePolicy: 'public_full',
      supplierBrandKey: 'kyowontour',
      expectFlightNumber: true,
    },
    reviewNeeded: !(outbound.flightNo && inbound.flightNo),
    reviewReasons: !(outbound.flightNo && inbound.flightNo) ? ['calendar_row_flight_no_partial'] : [],
  }
}
