import {
  buildModetourDirectedSegmentLinesFromFlightRaw,
  tryParseModetourFlightLines,
} from '../lib/flight-modetour-parser'

const REAL_BODY_FLIGHT = [
  '1일차 현지 출발: 08:00 관광',
  '중국남방항공',
  '출발 : 인천 2026.07.07(화) 19:20 → 연길 2026.07.07(화) 20:40 CZ6074',
  '도착 : 연길 2026.07.10(금) 10:10 → 인천 2026.07.10(금) 13:25 CZ6073',
].join('\n')

const lines = REAL_BODY_FLIGHT.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
const { result } = tryParseModetourFlightLines(lines, REAL_BODY_FLIGHT)
console.log('ok', result.ok, result.ok ? result.outLine : result)
if (result.ok) console.log('ob', result.outbound)
console.log(JSON.stringify(buildModetourDirectedSegmentLinesFromFlightRaw(REAL_BODY_FLIGHT), null, 2))
