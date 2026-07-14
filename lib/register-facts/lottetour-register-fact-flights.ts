/**
 * lottetour register-facts — evtListAjax 행·미팅·scheduleAjax air_plan → RegisterFactFlightLeg.
 *
 * REGRESSION-FREEZE[register-facts-completeness]: lottetourCalendarRowToRegisterFactFlights — manifest
 * REGRESSION-FREEZE[lottetour-register-api-parse]: buildLottetourFlightStructuredFromFactLegs — manifest
 * REGRESSION-FREEZE[lottetour-singapore-register-quality]: air_plan → fact flights (prefetch) — manifest
 */
import type { LottetourCalendarRow } from '@/lib/lottetour-departures'
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { buildLottetourFlightStructuredFromRegisterSources } from '@/lib/lottetour-register-api-detail'
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'

function extractFlightNoFromText(text: string | null | undefined): string | null {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const m = raw.match(/\b([A-Z0-9]{2}\d{2,4})\b/i)
  return m?.[1]?.toUpperCase() ?? null
}

function firstTimeToken(text: string | null | undefined): string | null {
  const parts = String(text ?? '')
    .split(/\s*~\s*|\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.find((p) => /\d{1,2}:\d{2}/.test(p)) ?? parts[0] ?? null
}

function secondTimeToken(text: string | null | undefined): string | null {
  const parts = String(text ?? '')
    .split(/\s*~\s*|\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const times = parts.filter((p) => /\d{1,2}:\d{2}/.test(p))
  return times[1] ?? null
}

function combineDateTime(date: string | null | undefined, time: string | null | undefined): string | null {
  const d = String(date ?? '').trim()
  const t = String(time ?? '').trim()
  if (!d) return null
  if (!t) return d
  return `${d}T${t}`
}

function meetingOnlyFlights(meetingPlaceRaw: string | null): RegisterFactFlightLeg[] {
  const place = meetingPlaceRaw?.trim()
  if (!place) return []
  return [
    {
      direction: 'outbound',
      carrier: null,
      flightNo: null,
      departureCity: place,
      departureAt: null,
      arrivalCity: null,
      arrivalAt: null,
    },
  ]
}

export function lottetourCalendarRowToRegisterFactFlights(
  row: LottetourCalendarRow | null | undefined,
  meetingPlaceRaw: string | null,
): RegisterFactFlightLeg[] {
  if (!row) return meetingOnlyFlights(meetingPlaceRaw)

  const carrier = row.carrierText?.trim() || null
  const outboundTime = firstTimeToken(row.departTimeText)
  const inboundDepTime = firstTimeToken(row.returnTimeText)
  const outboundFlightNo = extractFlightNoFromText(row.departTimeText) ?? extractFlightNoFromText(carrier)
  const inboundFlightNo = extractFlightNoFromText(row.returnTimeText) ?? outboundFlightNo
  const meeting = meetingPlaceRaw?.trim() || null

  const legs: RegisterFactFlightLeg[] = []

  if (carrier || outboundTime || row.departDate) {
    legs.push({
      direction: 'outbound',
      carrier,
      flightNo: outboundFlightNo,
      departureCity: meeting,
      departureAt: combineDateTime(row.departDate, outboundTime),
      arrivalCity: null,
      arrivalAt: combineDateTime(row.departDate, secondTimeToken(row.departTimeText)),
    })
  }

  if (carrier || inboundDepTime || row.returnDate) {
    legs.push({
      direction: 'inbound',
      carrier,
      flightNo: inboundFlightNo,
      departureCity: null,
      departureAt: combineDateTime(row.returnDate ?? row.departDate, inboundDepTime),
      arrivalCity: meeting,
      arrivalAt: combineDateTime(row.returnDate ?? row.departDate, secondTimeToken(row.returnTimeText)),
    })
  }

  return legs.length > 0 ? legs : meetingOnlyFlights(meetingPlaceRaw)
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

function structuredLegToFactLeg(
  direction: 'outbound' | 'inbound',
  leg: FlightStructured['outbound'],
  carrier: string | null,
): RegisterFactFlightLeg {
  return {
    direction,
    carrier,
    flightNo: leg.flightNo?.trim() || null,
    departureCity: leg.departureAirport?.trim() || null,
    departureAt: combineDateTime(leg.departureDate, leg.departureTime),
    arrivalCity: leg.arrivalAirport?.trim() || null,
    arrivalAt: combineDateTime(leg.arrivalDate, leg.arrivalTime),
  }
}

/** scheduleAjax air_plan 우선 — prefetch에서 detail-collect 생략해도 편명 유지 */
export function lottetourRegisterFactFlightsFromScheduleAndCalendar(
  scheduleAjaxHtml: string | null | undefined,
  row: LottetourCalendarRow | null | undefined,
  meetingPlaceRaw: string | null,
): RegisterFactFlightLeg[] {
  const fs = buildLottetourFlightStructuredFromRegisterSources({
    scheduleAjaxHtml: scheduleAjaxHtml ?? null,
    evtListRow: row ?? null,
  })
  if (fs) {
    const carrier = fs.airlineName?.trim() || row?.carrierText?.trim() || null
    const legs: RegisterFactFlightLeg[] = []
    if (fs.outbound.flightNo || fs.outbound.departureTime || fs.outbound.departureAirport) {
      legs.push(structuredLegToFactLeg('outbound', fs.outbound, carrier))
    }
    if (fs.inbound.flightNo || fs.inbound.departureTime || fs.inbound.arrivalAirport) {
      legs.push(structuredLegToFactLeg('inbound', fs.inbound, carrier))
    }
    if (legs.length > 0) {
      if (!legs[0]?.departureCity && meetingPlaceRaw?.trim()) {
        legs[0] = { ...legs[0]!, departureCity: meetingPlaceRaw.trim() }
      }
      return legs
    }
  }
  return lottetourCalendarRowToRegisterFactFlights(row, meetingPlaceRaw)
}

/** prefetch 경로 — detail-collect 생략 시 bundle.flights → flightStructured */
export function buildLottetourFlightStructuredFromFactLegs(
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
      supplierBrandKey: 'lottetour',
      expectFlightNumber: true,
    },
    reviewNeeded: false,
    reviewReasons: [],
  }
}
