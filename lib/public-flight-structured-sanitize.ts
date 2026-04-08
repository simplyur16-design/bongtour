import type { FlightStructured } from '@/lib/detail-body-parser-types'
import type { FlightStructuredBody } from '@/lib/public-product-extras'

/**
 * 공개 상세 직렬화용 persisted 항공 스냅샷.
 * 등록 파서 `FlightStructured`에는 `debug`·`modetourParseTrace` 등이 붙을 수 있어, 이 DTO만 네트워크로 보낸다.
 * 모두투어 leg 폴백(`tryModetourDepartureLegCardsFromFlightStructured` 등)에 필요한 필드만 유지.
 */
export type PublicPersistedFlightStructuredDto = {
  airlineName: string | null
  outbound: FlightStructured['outbound']
  inbound: FlightStructured['inbound']
  rawFlightLines: string[]
  reviewNeeded: boolean
  reviewReasons: string[]
}

function emptyLeg(): FlightStructured['outbound'] {
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

/** 가는편/오는편 — 공항·일시·편명·소요시간 텍스트만 (내부 메타 키 제거) */
function pickLegForPublic(leg: FlightStructured['outbound'] | null | undefined): FlightStructured['outbound'] {
  if (!leg || typeof leg !== 'object') return emptyLeg()
  return {
    departureAirport: leg.departureAirport ?? null,
    departureAirportCode: leg.departureAirportCode ?? null,
    departureDate: leg.departureDate ?? null,
    departureTime: leg.departureTime ?? null,
    arrivalAirport: leg.arrivalAirport ?? null,
    arrivalAirportCode: leg.arrivalAirportCode ?? null,
    arrivalDate: leg.arrivalDate ?? null,
    arrivalTime: leg.arrivalTime ?? null,
    flightNo: leg.flightNo ?? null,
    durationText: leg.durationText ?? null,
  }
}

export function toPublicPersistedFlightStructured(fs: FlightStructured | null): PublicPersistedFlightStructuredDto | null {
  if (!fs) return null
  return {
    airlineName: fs.airlineName ?? null,
    outbound: pickLegForPublic(fs.outbound),
    inbound: pickLegForPublic(fs.inbound),
    rawFlightLines: Array.isArray(fs.rawFlightLines) ? fs.rawFlightLines.slice() : [],
    reviewNeeded: Boolean(fs.reviewNeeded),
    reviewReasons: Array.isArray(fs.reviewReasons) ? fs.reviewReasons.slice() : [],
  }
}

export function sanitizeFlightStructuredBodyForPublic(body: FlightStructuredBody | null): FlightStructuredBody | null {
  if (!body) return null
  return {
    ...body,
    modetourPersistedFlightStructured: toPublicPersistedFlightStructured(body.modetourPersistedFlightStructured ?? null),
  }
}
