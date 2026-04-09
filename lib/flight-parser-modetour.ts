import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { createEmptyFlightLeg, stripLogoNoise } from '@/lib/flight-parser-generic'
import {
  extractModetourAirlineNameLoose,
  modetourLegIsDateTimeOnlyTransport,
  tryParseModetourFlightLines,
  type ModetourParseTrace,
} from '@/lib/flight-modetour-parser'

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

const KOREA_LOCATIONS = ['인천', '김포', '부산', '제주', '청주', '대구', '서울', 'ICN', 'GMP', 'PUS', 'CJU']

function isKoreaLocationToken(v: string | null | undefined): boolean {
  if (!v) return false
  const t = v.toUpperCase()
  return KOREA_LOCATIONS.some((k) => t.includes(k.toUpperCase()))
}

function modetourFailureFlightStructured(args: {
  trace: ModetourParseTrace
  sectionClean: string
  airlineHint: string | null
}): FlightStructured {
  const empty = createEmptyFlightLeg()
  const supplierBrandKey = 'modetour'
  const expectFlightNumber = true
  return {
    airlineName: args.airlineHint,
    outbound: empty,
    inbound: empty,
    rawFlightLines: args.sectionClean
      .split('\n')
      .map(cleanLine)
      .filter(Boolean)
      .slice(0, 20),
    debug: {
      candidateCount: 0,
      selectedOutRaw: args.trace.outboundLineRaw,
      selectedInRaw: args.trace.inboundLineRaw,
      partialStructured: false,
      status: 'failure',
      exposurePolicy: 'admin_only',
      secondaryScanBlockCount: 0,
      secondaryFlightSnippet: null,
      supplierBrandKey,
      expectFlightNumber,
      modetourParseTrace: { ...args.trace, usedFallbackGenericParser: false },
    },
    reviewNeeded: true,
    reviewReasons: ['모두투어 출발/도착(→) 형식 항공 줄을 찾지 못했습니다. 원문 검수'],
  }
}

/**
 * 모두투어(modetour) 관리자 항공 붙여넣기 전용 — `flight-modetour-parser` 결정적 파서만 사용.
 * (공용 `parseFlightSectionGeneric` 폴백 제거)
 */
export function parseFlightSectionModetour(section: string, fullBodyForSecondary?: string | null): FlightStructured {
  const sectionClean = stripLogoNoise(section)
  const lines = sectionClean.split('\n').map(cleanLine).filter(Boolean)

  const { result: mt, trace: mtTrace } = tryParseModetourFlightLines(lines, sectionClean)
  const expectFlightNumber = true
  const supplierBrandKey = 'modetour'

  if (!mt.ok) {
    const hint =
      extractModetourAirlineNameLoose(sectionClean) || extractModetourAirlineNameLoose(fullBodyForSecondary ?? '')
    return modetourFailureFlightStructured({ trace: mtTrace, sectionClean, airlineHint: hint })
  }

  let modetourTraceForDebug = { ...mtTrace, usedFallbackGenericParser: false as const }
  let outLeg = { ...createEmptyFlightLeg(), ...mt.outbound }
  let inLeg = { ...createEmptyFlightLeg(), ...mt.inbound }
  let airlineNameResolved =
    mt.airlineName?.trim() ||
    extractModetourAirlineNameLoose(sectionClean) ||
    extractModetourAirlineNameLoose(fullBodyForSecondary ?? '') ||
    null
  const likelyOutIsKoreaDepart = isKoreaLocationToken(outLeg.departureAirport)
  const likelyInIsKoreaArrive = isKoreaLocationToken(inLeg.arrivalAirport)
  if (!likelyOutIsKoreaDepart && !likelyInIsKoreaArrive) {
    const swappedOutK = isKoreaLocationToken(outLeg.arrivalAirport)
    const swappedInK = isKoreaLocationToken(inLeg.departureAirport)
    if (swappedOutK && swappedInK) {
      const o = { ...outLeg }
      outLeg.departureAirport = inLeg.departureAirport
      outLeg.arrivalAirport = inLeg.arrivalAirport
      outLeg.departureDate = inLeg.departureDate
      outLeg.departureTime = inLeg.departureTime
      outLeg.flightNo = inLeg.flightNo
      outLeg.departureAirportCode = inLeg.departureAirportCode
      outLeg.arrivalAirportCode = inLeg.arrivalAirportCode
      inLeg.departureAirport = o.departureAirport
      inLeg.arrivalAirport = o.arrivalAirport
      inLeg.departureDate = o.departureDate
      inLeg.departureTime = o.departureTime
      inLeg.flightNo = o.flightNo
      inLeg.departureAirportCode = o.departureAirportCode
      inLeg.arrivalAirportCode = o.arrivalAirportCode
    }
  }
  const reviewReasons: string[] = []
  const outCore = [
    outLeg.departureAirport,
    outLeg.arrivalAirport,
    outLeg.departureDate,
    outLeg.departureTime,
    outLeg.flightNo,
    outLeg.departureAirportCode,
    outLeg.arrivalAirportCode,
    outLeg.durationText,
  ].filter(Boolean).length
  const inCore = [
    inLeg.departureAirport,
    inLeg.arrivalAirport,
    inLeg.departureDate,
    inLeg.departureTime,
    inLeg.flightNo,
    inLeg.departureAirportCode,
    inLeg.arrivalAirportCode,
    inLeg.durationText,
  ].filter(Boolean).length
  const partialStructured = outCore >= 2 || inCore >= 2
  const successStructured = outCore >= 3 && inCore >= 3
  const status: 'success' | 'partial' | 'failure' = successStructured ? 'success' : partialStructured ? 'partial' : 'failure'
  const exposurePolicy: 'public_full' | 'public_limited' | 'admin_only' =
    status === 'success' ? 'public_full' : status === 'partial' ? 'public_limited' : 'admin_only'
  if (
    expectFlightNumber &&
    !outLeg.flightNo &&
    !inLeg.flightNo &&
    !(modetourLegIsDateTimeOnlyTransport(outLeg) && modetourLegIsDateTimeOnlyTransport(inLeg))
  ) {
    reviewReasons.push('편명 누락')
  }

  return {
    airlineName: airlineNameResolved,
    outbound: outLeg,
    inbound: inLeg,
    rawFlightLines: [mt.outLine, mt.inLine],
    debug: {
      candidateCount: 2,
      selectedOutRaw: mt.outLine,
      selectedInRaw: mt.inLine,
      partialStructured,
      status,
      exposurePolicy,
      secondaryScanBlockCount: 0,
      secondaryFlightSnippet: null,
      supplierBrandKey,
      expectFlightNumber,
      modetourParseTrace: modetourTraceForDebug,
    },
    reviewNeeded: status === 'failure',
    reviewReasons,
  }
}
