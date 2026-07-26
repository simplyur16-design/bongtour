/**
 * hanatour register-facts — pkgAirSeqList → RegisterFactFlightLeg → flightStructured (prefetch SSOT).
 *
 * REGRESSION-FREEZE[register-detail-collect-flight-apply]: facts legs → flightStructured — manifest
 * REGRESSION-FREEZE[hanatour-register-detail-collect]: pkgAirSeqList → fact flights — manifest
 */
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import {
  buildHanatourFlightStructuredFromProdInfo,
  type HanatourProdInfoExtended,
} from '@/lib/hanatour-register-api-detail'
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'

function combineDateTime(date: string | null | undefined, time: string | null | undefined): string | null {
  const d = String(date ?? '').trim()
  const t = String(time ?? '').trim()
  if (!d) return null
  if (!t) return d
  return `${d}T${t}`
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

/** getPkgProdInfo.pkgAirSeqList → register-facts flights (calendar firstInput보다 우선). */
export function hanatourProdInfoToFactFlightLegs(
  info: HanatourProdInfoExtended | null | undefined,
): RegisterFactFlightLeg[] {
  const fs = buildHanatourFlightStructuredFromProdInfo(info)
  if (!fs) return []
  const legs: RegisterFactFlightLeg[] = []
  const push = (direction: 'outbound' | 'inbound', leg: FlightStructured['outbound']) => {
    if (!(leg.flightNo || leg.departureTime || leg.departureAirport)) return
    legs.push({
      direction,
      carrier: fs.airlineName,
      flightNo: leg.flightNo,
      departureCity: leg.departureAirport,
      departureAt: combineDateTime(leg.departureDate, leg.departureTime),
      arrivalCity: leg.arrivalAirport,
      arrivalAt: combineDateTime(leg.arrivalDate, leg.arrivalTime),
    })
  }
  push('outbound', fs.outbound)
  push('inbound', fs.inbound)
  return legs
}

/** prefetch 경로 — detail-collect 생략 시 bundle.flights → flightStructured */
// REGRESSION-FREEZE[register-detail-collect-flight-apply]: prefetch facts flights → flightStructured — manifest
export function buildHanatourFlightStructuredFromFactLegs(
  legs: readonly RegisterFactFlightLeg[] | null | undefined,
): FlightStructured | null {
  if (!legs?.length) return null
  const obLeg = legs.find((l) => l.direction === 'outbound')
  const ibLeg = legs.find((l) => l.direction === 'inbound')
  if (!obLeg && !ibLeg) return null
  const outbound = obLeg ? factLegToStructuredLeg(obLeg) : emptyFlightLeg()
  const inbound = ibLeg ? factLegToStructuredLeg(ibLeg) : emptyFlightLeg()
  const airlineName = obLeg?.carrier?.trim() || ibLeg?.carrier?.trim() || null
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
      supplierBrandKey: 'hanatour',
      expectFlightNumber: true,
    },
    reviewNeeded: false,
    reviewReasons: [],
  }
}
