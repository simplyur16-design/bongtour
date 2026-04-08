/** 참좋은: `날짜 (요일) 시각 도시 출발|도착` 두 줄을 ` | `로 이은 문자열 보정용 */
export type VerygoodTourPipeLeg = {
  departureAirport: string | null
  departureAirportCode: string | null
  departureDate: string | null
  departureTime: string | null
  arrivalAirport: string | null
  arrivalAirportCode: string | null
  arrivalDate: string | null
  arrivalTime: string | null
  flightNo: string | null
  durationText: string | null
}

const VERYGOODTOUR_FLIGHT_SEGMENT_RE =
  /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*(?:\([^)]*\))?\s*([0-2]?\d:[0-5]\d)\s+(.+?)\s+(출발|도착)\s*\\*\s*$/iu

export function tryParseVerygoodTourPipeJoinedLeg(raw: string | null | undefined): VerygoodTourPipeLeg | null {
  if (!raw || !String(raw).includes('|')) return null
  const parts = String(raw)
    .split(/\s*\|\s*/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (parts.length < 2) return null

  const parseSeg = (s: string) => {
    const m = s.match(VERYGOODTOUR_FLIGHT_SEGMENT_RE)
    if (!m) return null
    const dateRaw = m[1]!
    const date = dateRaw.replace(/[.]/g, '-').replace(/^\d{2}-/, '20')
    return { date, time: m[2]!, city: m[3]!.trim(), kind: m[4] as '출발' | '도착' }
  }

  let a = parseSeg(parts[0]!)
  let b = parseSeg(parts[1]!)
  if (!a || !b) return null
  if (a.kind === '도착' && b.kind === '출발') {
    const t = a
    a = b
    b = t
  }
  if (a.kind !== '출발' || b.kind !== '도착') return null

  return {
    departureAirport: a.city,
    departureAirportCode: null,
    departureDate: a.date,
    departureTime: a.time,
    arrivalAirport: b.city,
    arrivalAirportCode: null,
    arrivalDate: b.date,
    arrivalTime: b.time,
    flightNo: null,
    durationText: null,
  }
}
