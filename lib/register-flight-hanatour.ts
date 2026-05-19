/**
 * [하나투어 항공 스택 P2] 등록·미리보기 — structured → directed segment 한 줄.
 *
 * 역할: `resolveDirectedFlightLinesHanatour` — `register-from-llm-hanatour`에 필수 주입(P1b).
 * `도착 :` → inbound only (`flight-parser-hanatour`와 동일).
 * 하지 않음: leg 1차 파싱, ProductDeparture 행 enrich, 공개 달력 정렬, FMC.
 * modetour `resolveDirectedFlightLinesDeterministicOnly` / `flight-modetour-parser` 사용 금지.
 *
 * 계약: `docs/ops/hanatour-parse-contract.md`
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import { formatDirectedFlightRow } from '@/lib/flight-user-display'

function combineFlightDateTime(d: string | null | undefined, t: string | null | undefined): string | null {
  const dd = (d ?? '').replace(/-/g, '.').trim()
  const tt = (t ?? '').trim()
  if (dd && tt) return `${dd} ${tt}`
  return dd || tt || null
}

export function resolveDirectedFlightLinesHanatour(detailBody: DetailBodyParseSnapshot): {
  departureSegmentFromStructured: string | null
  returnSegmentFromStructured: string | null
} {
  const fs = detailBody.flightStructured
  if (!fs) {
    return { departureSegmentFromStructured: null, returnSegmentFromStructured: null }
  }
  const dbg = fs.debug
  const obLeg = fs.outbound
  const ibLeg = fs.inbound
  const obHas =
    Boolean(obLeg.flightNo?.trim()) ||
    Boolean(obLeg.departureDate?.trim()) ||
    Boolean(obLeg.departureTime?.trim()) ||
    Boolean(obLeg.arrivalDate?.trim()) ||
    Boolean(obLeg.arrivalTime?.trim()) ||
    Boolean(obLeg.departureAirport?.trim()) ||
    Boolean(obLeg.arrivalAirport?.trim())
  const ibHas =
    Boolean(ibLeg.flightNo?.trim()) ||
    Boolean(ibLeg.departureDate?.trim()) ||
    Boolean(ibLeg.departureTime?.trim()) ||
    Boolean(ibLeg.arrivalDate?.trim()) ||
    Boolean(ibLeg.arrivalTime?.trim()) ||
    Boolean(ibLeg.departureAirport?.trim()) ||
    Boolean(ibLeg.arrivalAirport?.trim())
  const statusOk = dbg?.status === 'success' || dbg?.status === 'partial'
  if (!statusOk && !obHas && !ibHas) {
    return { departureSegmentFromStructured: null, returnSegmentFromStructured: null }
  }
  const dep = formatDirectedFlightRow('가는편', {
    departureAirport: obLeg.departureAirport,
    arrivalAirport: obLeg.arrivalAirport,
    departureAtText: combineFlightDateTime(obLeg.departureDate, obLeg.departureTime),
    arrivalAtText: combineFlightDateTime(obLeg.arrivalDate, obLeg.arrivalTime),
    flightNo: obLeg.flightNo,
    durationText: obLeg.durationText,
  }).line
  const ret = formatDirectedFlightRow('오는편', {
    departureAirport: ibLeg.departureAirport,
    arrivalAirport: ibLeg.arrivalAirport,
    departureAtText: combineFlightDateTime(ibLeg.departureDate, ibLeg.departureTime),
    arrivalAtText: combineFlightDateTime(ibLeg.arrivalDate, ibLeg.arrivalTime),
    flightNo: ibLeg.flightNo,
    durationText: ibLeg.durationText,
  }).line
  return {
    departureSegmentFromStructured: obHas || statusOk ? dep : null,
    returnSegmentFromStructured: ibHas || statusOk ? ret : null,
  }
}
