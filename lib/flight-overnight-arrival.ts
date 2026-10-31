/**
 * 야간편 도착일 표시 보정 (표시 전용 — 저장된 공급사 원문 값은 바꾸지 않음).
 *
 * 규칙: 도착 시각 < 출발 시각 이고 도착 날짜가 출발 날짜와 같거나 비어 있으면
 * 도착을 출발일 다음날(올바른 요일)로 표시한다.
 *
 * 예외: 날짜변경선을 동쪽으로 넘는 구간(아시아 → 하와이·미주)은 같은 날 더 이른 시각 도착이
 * 실제로 맞고, 미주·하와이 출발편은 +2일 도착도 있어 +1 추정이 틀릴 수 있으므로 손대지 않는다.
 */
import {
  combineDateKeyWithHm,
  extractHmFromKoreanDateTimeLine,
  formatKoreanDateTimeLine,
} from '@/lib/flight-korean-datetime'
import { addDaysIso, extractIsoDate } from '@/lib/hero-date-utils'

/** 하와이·미주(날짜변경선 동쪽) 공항·도시 표기 — 이 구간은 같은 날 이른 도착이 정상일 수 있음 */
const EAST_OF_DATELINE_AIRPORT_RE =
  /(하와이|호놀룰루|오아후|마우이|카우아이|코나|힐로|빅아일랜드|로스\s*앤젤레스|로스앤젤레스|샌프란시스코|라스\s*베(이)?가스|시애틀|포틀랜드|뉴욕|뉴어크|시카고|애틀랜타|댈러스|휴스턴|보스턴|워싱턴|디트로이트|미니애폴리스|앵커리지|밴쿠버|토론토|캘거리|몬트리올|옐로우\s*나이프|멕시코|칸쿤|리마|산티아고|상파울루|부에노스|산호세|파나마|보고타|미국|캐나다|\b(HNL|OGG|KOA|LIH|ITO|LAX|SFO|LAS|SEA|PDX|JFK|EWR|ORD|ATL|DFW|IAH|BOS|IAD|DTW|MSP|ANC|YVR|YYZ|YYC|YUL|YZF|MEX|CUN|LIM|SCL|GRU|EZE|SJO|PTY|BOG)\b)/i

export function isEastOfDatelineLeg(
  departureAirport: string | null | undefined,
  arrivalAirport: string | null | undefined
): boolean {
  return (
    EAST_OF_DATELINE_AIRPORT_RE.test(departureAirport ?? '') ||
    EAST_OF_DATELINE_AIRPORT_RE.test(arrivalAirport ?? '')
  )
}

function hmToMinutes(hm: string | null): number | null {
  const m = hm?.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

export type OvernightArrivalInput = {
  departureAtText: string | null | undefined
  arrivalAtText: string | null | undefined
  departureAirport?: string | null
  arrivalAirport?: string | null
  /** 본문에 붙어 있던 `+N` (있으면 그 일수만큼, 없으면 1일) */
  embeddedDayOffset?: number | null
}

/**
 * 도착 일시 문자열을 표시용으로 보정한다. 보정 대상이 아니면 원문(trim)을 그대로 돌려준다.
 * `rolledDays` 는 출발일 대비 도착일 차이(보정된 경우에만 >0).
 */
export function resolveOvernightArrivalAtText(input: OvernightArrivalInput): {
  arrivalAtText: string | null
  rolledDays: number | null
} {
  const arrRaw = input.arrivalAtText?.replace(/\s+/g, ' ').trim() || ''
  const depRaw = input.departureAtText?.replace(/\s+/g, ' ').trim() || ''
  const keep = { arrivalAtText: arrRaw || null, rolledDays: null }
  if (!arrRaw || !depRaw) return keep
  const depIso = extractIsoDate(depRaw)
  if (!depIso) return keep
  const arrIso = extractIsoDate(arrRaw)
  if (arrIso && arrIso !== depIso) return keep
  const arrHm = extractHmFromKoreanDateTimeLine(arrRaw)
  const depHm = extractHmFromKoreanDateTimeLine(depRaw)
  const arrMin = hmToMinutes(arrHm)
  const depMin = hmToMinutes(depHm)
  if (arrMin == null || depMin == null) return keep
  const embedded = input.embeddedDayOffset != null && input.embeddedDayOffset > 0 ? input.embeddedDayOffset : null
  if (!embedded && arrMin >= depMin) return keep
  if (!embedded && isEastOfDatelineLeg(input.departureAirport, input.arrivalAirport)) return keep
  const days = embedded ?? 1
  const nextIso = addDaysIso(depIso, days)
  if (!nextIso) return keep
  const out = formatKoreanDateTimeLine(combineDateKeyWithHm(nextIso, arrHm))
  if (!out) return keep
  return { arrivalAtText: out, rolledDays: days }
}
