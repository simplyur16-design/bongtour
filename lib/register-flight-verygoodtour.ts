/**
 * 참좋은여행 등록 전용: structured 항공으로 가는/오는 편 한 줄 생성.
 * 모두투어 결정적 trace 플래그 없이 partial/success 시에도 노출한다.
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import { formatDirectedFlightRow } from '@/lib/flight-user-display'

function combineFlightDateTime(d: string | null | undefined, t: string | null | undefined): string | null {
  const dd = (d ?? '').replace(/-/g, '.').trim()
  const tt = (t ?? '').trim()
  if (dd && tt) return `${dd} ${tt}`
  return dd || tt || null
}

export function resolveDirectedFlightLinesVerygoodtour(detailBody: DetailBodyParseSnapshot): {
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
    Boolean(obLeg.departureAirport?.trim()) ||
    Boolean(obLeg.arrivalAirport?.trim()) ||
    Boolean(obLeg.departureDate?.trim()) ||
    Boolean(obLeg.departureTime?.trim())
  const ibHas =
    Boolean(ibLeg.departureAirport?.trim()) ||
    Boolean(ibLeg.arrivalAirport?.trim()) ||
    Boolean(ibLeg.departureDate?.trim()) ||
    Boolean(ibLeg.departureTime?.trim())
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
  }).line
  const ret = formatDirectedFlightRow('오는편', {
    departureAirport: ibLeg.departureAirport,
    arrivalAirport: ibLeg.arrivalAirport,
    departureAtText: combineFlightDateTime(ibLeg.departureDate, ibLeg.departureTime),
    arrivalAtText: combineFlightDateTime(ibLeg.arrivalDate, ibLeg.arrivalTime),
    flightNo: ibLeg.flightNo,
  }).line
  return {
    departureSegmentFromStructured: obHas || statusOk ? dep : null,
    returnSegmentFromStructured: ibHas || statusOk ? ret : null,
  }
}
