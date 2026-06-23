/**
 * 등록 상세 수집 — API flightStructured → parsed 평탄 필드 병합 (라우터만).
 *
 * REGRESSION-FREEZE[register-detail-collect-flight-apply]: applyRegisterCollectedFlightStructured — manifest
 */
import type { FlightStructured } from '@/lib/detail-body-parser-types'

type ParsedWithFlight = {
  airlineName?: string | null
  outboundFlightNo?: string | null
  inboundFlightNo?: string | null
  departureDateTimeRaw?: string | null
  arrivalDateTimeRaw?: string | null
  detailBodyStructured?: { flightStructured?: FlightStructured } & Record<string, unknown>
}

export function registerFlightCollectLooksComplete(parsed: ParsedWithFlight): boolean {
  const fs = parsed.detailBodyStructured?.flightStructured
  const airline = parsed.airlineName?.trim() || fs?.airlineName?.trim()
  const obFn = parsed.outboundFlightNo?.trim() || fs?.outbound?.flightNo?.trim()
  const ibFn = parsed.inboundFlightNo?.trim() || fs?.inbound?.flightNo?.trim()
  const obTime = fs?.outbound?.departureTime?.trim()
  const ibTime = fs?.inbound?.departureTime?.trim()
  return Boolean(airline && obFn && ibFn && obTime && ibTime)
}

export function needsRegisterFlightApiCollect(parsed: ParsedWithFlight): boolean {
  return !registerFlightCollectLooksComplete(parsed)
}

export function applyRegisterCollectedFlightStructured<T extends ParsedWithFlight>(
  parsed: T,
  flightStructured: FlightStructured | null | undefined,
): T {
  if (!flightStructured) return parsed
  const ob = flightStructured.outbound
  const ib = flightStructured.inbound
  return {
    ...parsed,
    airlineName: flightStructured.airlineName?.trim() || parsed.airlineName,
    outboundFlightNo: ob.flightNo?.trim() || parsed.outboundFlightNo,
    inboundFlightNo: ib.flightNo?.trim() || parsed.inboundFlightNo,
    departureDateTimeRaw:
      ob.departureDate && ob.departureTime
        ? `${ob.departureDate} ${ob.departureTime}`
        : parsed.departureDateTimeRaw,
    arrivalDateTimeRaw:
      ib.arrivalDate && ib.arrivalTime
        ? `${ib.arrivalDate} ${ib.arrivalTime}`
        : parsed.arrivalDateTimeRaw,
    detailBodyStructured: {
      ...(parsed.detailBodyStructured ?? {}),
      flightStructured,
    },
  }
}
