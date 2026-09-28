/**
 * ybtour register-facts — scheduleDetailTm fact legs → flightStructured (prefetch SSOT).
 *
 * REGRESSION-FREEZE[ybtour-register-flight-from-fact-legs]: facts legs → flightStructured — manifest
 * REGRESSION-FREEZE[register-detail-collect-flight-apply]: prefetch facts flights → flightStructured — manifest
 */
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'

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
  const depAt = String(leg.departureAt ?? '').trim()
  const arrAt = String(leg.arrivalAt ?? '').trim()
  const depDate = depAt.includes('T') ? depAt.slice(0, 10) : depAt.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null
  const depTime = depAt.includes('T') ? depAt.slice(11, 16) : null
  const arrDate = arrAt.includes('T') ? arrAt.slice(0, 10) : arrAt.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null
  const arrTime = arrAt.includes('T') ? arrAt.slice(11, 16) : null
  return {
    departureAirport: leg.departureCity?.trim() || null,
    departureAirportCode: null,
    departureDate: depDate,
    departureTime: depTime,
    arrivalAirport: leg.arrivalCity?.trim() || null,
    arrivalAirportCode: null,
    arrivalDate: arrDate,
    arrivalTime: arrTime,
    flightNo: leg.flightNo?.trim() || null,
    durationText: null,
  }
}

/** prefetch / api-parse — detail-collect 생략 시 bundle.flights → flightStructured */
// REGRESSION-FREEZE[ybtour-register-flight-from-fact-legs]: buildYbtourFlightStructuredFromFactLegs — manifest
export function buildYbtourFlightStructuredFromFactLegs(
  legs: readonly RegisterFactFlightLeg[] | null | undefined,
  opts?: { airlineName?: string | null },
): FlightStructured | null {
  if (!legs?.length) return null
  const obLeg = legs.find((l) => l.direction === 'outbound')
  const ibLeg = legs.find((l) => l.direction === 'inbound')
  if (!obLeg && !ibLeg) return null
  const outbound = obLeg ? factLegToStructuredLeg(obLeg) : emptyFlightLeg()
  const inbound = ibLeg ? factLegToStructuredLeg(ibLeg) : emptyFlightLeg()
  const airlineName =
    opts?.airlineName?.trim() ||
    obLeg?.carrier?.trim() ||
    ibLeg?.carrier?.trim() ||
    null
  const hasOb = Boolean(outbound.flightNo || outbound.departureTime || outbound.departureAirport)
  const hasIb = Boolean(inbound.flightNo || inbound.departureTime || inbound.arrivalAirport)
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
      supplierBrandKey: 'ybtour',
      expectFlightNumber: true,
    },
    reviewNeeded: false,
    reviewReasons: [],
  }
}
