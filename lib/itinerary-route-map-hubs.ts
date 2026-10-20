/**
 * Product.schedule → 방문 거점(도시) 연속 일차 묶음 + 구간 교통 힌트.
 */

import { mapDestination } from '@/lib/pexels-keyword'
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'
import { softDupForeignVisitCityForMiddleRoute } from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { filterRegisterScheduleRoutePlaceSegments } from '@/lib/register-schedule-route-place-noise'
import { isScheduleAirportRouteSegmentText } from '@/lib/schedule-image-keyword-adjacent-poi'
import type {
  ItineraryRouteMapHub,
  ItineraryRouteMapLeg,
  ItineraryRouteMapLineStyle,
  ItineraryRouteMapScheduleDay,
} from '@/lib/itinerary-route-map-types'

/** routeText 한글 토큰 → 영문 거점 (mapDestination 미매핑 소도시 보강) */
const CITY_KO_TO_EN: Record<string, string> = {
  도쿄: 'Tokyo',
  오사카: 'Osaka',
  교토: 'Kyoto',
  하코네: 'Hakone',
  삿포로: 'Sapporo',
  후쿠오카: 'Fukuoka',
  나고야: 'Nagoya',
  오키나와: 'Okinawa',
  나하: 'Naha',
  히로시마: 'Hiroshima',
  나라: 'Nara',
  고베: 'Kobe',
  요코하마: 'Yokohama',
  다낭: 'Da Nang',
  하노이: 'Hanoi',
  나트랑: 'Nha Trang',
  푸꾸옥: 'Phu Quoc',
  방콕: 'Bangkok',
  치앙마이: 'Chiang Mai',
  푸켓: 'Phuket',
  싱가포르: 'Singapore',
  타이페이: 'Taipei',
  홍콩: 'Hong Kong',
  괌: 'Guam',
  사이판: 'Saipan',
  파리: 'Paris',
  로마: 'Rome',
  피렌체: 'Florence',
  밀라노: 'Milan',
  베니스: 'Venice',
  바르셀로나: 'Barcelona',
  마드리드: 'Madrid',
  런던: 'London',
  프라하: 'Prague',
  비엔나: 'Vienna',
  부다페스트: 'Budapest',
  아테네: 'Athens',
  산토리니: 'Santorini',
  카이로: 'Cairo',
  두바이: 'Dubai',
  시드니: 'Sydney',
  멜버른: 'Melbourne',
  오클랜드: 'Auckland',
  퀸스타운: 'Queenstown',
  로토루아: 'Rotorua',
  뉴욕: 'New York',
  로스앤젤레스: 'Los Angeles',
  라스베이거스: 'Las Vegas',
  샌프란시스코: 'San Francisco',
  호놀룰루: 'Honolulu',
  몰디브: 'Maldives',
  서안: 'Xian',
  베이징: 'Beijing',
  상하이: 'Shanghai',
  장가계: 'Zhangjiajie',
  호이안: 'Hoi An',
  호치민: 'Ho Chi Minh',
}

const CITY_EN_TO_KO: Record<string, string> = {
  Tokyo: '도쿄',
  Osaka: '오사카',
  Kyoto: '교토',
  Hakone: '하코네',
  Sapporo: '삿포로',
  Fukuoka: '후쿠오카',
  Nagoya: '나고야',
  Okinawa: '오키나와',
  Naha: '나하',
  Hiroshima: '히로시마',
  Nara: '나라',
  Kobe: '고베',
  Yokohama: '요코하마',
  Busan: '부산',
  Seoul: '서울',
  Jeju: '제주',
  Taipei: '타이페이',
  'Hong Kong': '홍콩',
  Bangkok: '방콕',
  'Chiang Mai': '치앙마이',
  'Phuket': '푸켓',
  'Da Nang': '다낭',
  Hanoi: '하노이',
  'Ho Chi Minh': '호치민',
  'Nha Trang': '나트랑',
  'Phu Quoc': '푸꾸옥',
  Singapore: '싱가포르',
  'Kuala Lumpur': '쿠알라룸푸르',
  'Kota Kinabalu': '코타키나발루',
  Bali: '발리',
  Guam: '괌',
  Saipan: '사이판',
  Paris: '파리',
  Rome: '로마',
  Florence: '피렌체',
  Milan: '밀라노',
  Venice: '베니스',
  Barcelona: '바르셀로나',
  Madrid: '마드리드',
  London: '런던',
  Prague: '프라하',
  Vienna: '비엔나',
  Budapest: '부다페스트',
  Athens: '아테네',
  Santorini: '산토리니',
  Cairo: '카이로',
  Dubai: '두바이',
  Sydney: '시드니',
  Melbourne: '멜버른',
  Auckland: '오클랜드',
  Queenstown: '퀸스타운',
  Rotorua: '로토루아',
  'New York': '뉴욕',
  'Los Angeles': '로스앤젤레스',
  'Las Vegas': '라스베이거스',
  'San Francisco': '샌프란시스코',
  Honolulu: '호놀룰루',
  Maldives: '몰디브',
  Xian: '서안',
  Beijing: '베이징',
  Shanghai: '상하이',
  Zhangjiajie: '장가계',
  'Hoi An': '호이안',
  'Ho Chi Minh': '호치민',
}

function isDomesticDepartureHub(token: string): boolean {
  const t = String(token ?? '').trim()
  if (!t) return true
  if (/^(?:인천|김포|부산|대구|청주|김해|서울)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u.test(t)) {
    return true
  }
  return /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|ICN|GMP|PUS|TAE|CJJ)$/i.test(t)
}

function normCityKey(en: string): string {
  return en.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function formatItineraryRouteMapDayLabel(days: number[]): string {
  const sorted = [...new Set(days.filter((d) => Number.isFinite(d) && d >= 1))].sort((a, b) => a - b)
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return String(sorted[0])
  let consecutive = true
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1]! + 1) {
      consecutive = false
      break
    }
  }
  if (consecutive) return `${sorted[0]}~${sorted[sorted.length - 1]}`
  return sorted.join(',')
}

function koreanLabelForCity(cityEn: string, routeText: string | null | undefined): string {
  const segs = filterRegisterScheduleRoutePlaceSegments(splitRouteTextPlaceSegments(routeText))
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && !isDomesticDepartureHub(s))
  for (const seg of segs) {
    if (segs.length > 1 && isScheduleAirportRouteSegmentText(seg)) continue
    const mapped = mapDestination(seg)
    if (mapped && normCityKey(mapped) === normCityKey(cityEn) && /[\uAC00-\uD7AF]/.test(seg)) {
      return seg.replace(/\s*(?:국제\s*)?공항.*$/u, '').trim() || cityEn
    }
  }
  return CITY_EN_TO_KO[cityEn] ?? cityEn
}

function cityEnFromDay(day: ItineraryRouteMapScheduleDay): string {
  const segs = filterRegisterScheduleRoutePlaceSegments(splitRouteTextPlaceSegments(day.routeText))
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && !isDomesticDepartureHub(s))

  // 이동일(도쿄 - 하코네): 마지막 비허브 세그먼트를 도착 거점으로
  const ordered = segs.length > 1 ? [...segs].reverse() : segs
  for (const seg of ordered) {
    if (segs.length > 1 && isScheduleAirportRouteSegmentText(seg)) continue
    const koHit = CITY_KO_TO_EN[seg]
    if (koHit) return koHit
    const mapped = mapDestination(seg)
    if (
      mapped &&
      isBareCityOrCountryKeyword(mapped) &&
      !isDomesticDepartureHub(mapped) &&
      !/[\uAC00-\uD7AF]/.test(mapped)
    ) {
      return mapped
    }
  }

  const fromSoft = softDupForeignVisitCityForMiddleRoute(day.routeText)
  if (fromSoft && isBareCityOrCountryKeyword(fromSoft) && !isDomesticDepartureHub(fromSoft)) {
    return fromSoft
  }

  const cityField = String(day.city ?? '').trim()
  if (cityField) {
    if (CITY_KO_TO_EN[cityField]) return CITY_KO_TO_EN[cityField]!
    const mapped = mapDestination(cityField)
    if (mapped && isBareCityOrCountryKeyword(mapped) && !isDomesticDepartureHub(mapped)) return mapped
  }

  return ''
}

function extractDurationLabel(hay: string): string | null {
  const m =
    hay.match(/약\s*(\d{1,2})\s*시간\s*(\d{1,2})\s*분/) ||
    hay.match(/(\d{1,2})\s*시간\s*(\d{1,2})\s*분/) ||
    hay.match(/약\s*(\d{1,2})\s*시간/) ||
    hay.match(/(\d{1,2})\s*시간/) ||
    hay.match(/약\s*(\d{1,3})\s*분/) ||
    hay.match(/(\d{1,3})\s*분/)
  if (!m) return null
  if (m[2]) return `약 ${m[1]}시간 ${m[2]}분`
  if (/분/.test(m[0]!)) return `약 ${m[1]}분`
  return `약 ${m[1]}시간`
}

/** 근거리 도시쌍 — 기본 소요시간·아이콘을 짧게 (거대 호 유도 완화) */
function isShortHopCityPair(aEn: string, bEn: string): boolean {
  const a = normCityKey(aEn)
  const b = normCityKey(bEn)
  const pairs: Array<[string, string]> = [
    ['osaka', 'kyoto'],
    ['osaka', 'nara'],
    ['osaka', 'kobe'],
    ['kyoto', 'nara'],
    ['tokyo', 'yokohama'],
    ['da nang', 'hoi an'],
    ['hanoi', 'halong'],
    ['bangkok', 'pattaya'],
    ['taipei', 'jiufen'],
    ['hong kong', 'macau'],
  ]
  return pairs.some(
    ([x, y]) => (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x)),
  )
}

function inferLeg(
  from: ItineraryRouteMapHub,
  to: ItineraryRouteMapHub,
  dayHaystacks: Map<number, string>,
): ItineraryRouteMapLeg {
  const fromLast = from.days[from.days.length - 1]!
  const toFirst = to.days[0]!
  const hay = [dayHaystacks.get(fromLast), dayHaystacks.get(toFirst)].filter(Boolean).join('\n')
  const durationFromText = extractDurationLabel(hay)

  const shortHop = isShortHopCityPair(from.cityEn, to.cityEn)
  let icon = shortHop ? '🚌' : '🚄'
  let durationLabel = durationFromText || (shortHop ? '약 1시간' : '약 2시간')
  let lineStyle: ItineraryRouteMapLineStyle = 'dashed_green'

  if (/비행|항공|flight|✈️|항공기/i.test(hay)) {
    icon = '✈️'
    durationLabel = durationFromText || '약 2시간 30분'
  } else if (/페리|ferry|배편|크루즈/i.test(hay)) {
    icon = '⛴️'
    durationLabel = durationFromText || '약 1시간'
  } else if (/버스|bus|고속버스/i.test(hay)) {
    icon = '🚌'
    durationLabel = durationFromText || (shortHop ? '약 45분' : '약 1시간 30분')
  } else if (/지하철|전철|metro|subway|MRT/i.test(hay)) {
    icon = '🚇'
    durationLabel = durationFromText || '약 30분'
    lineStyle = 'solid_blue'
  } else if (/신칸센|新幹線|고속철|KTX|기차|열차|train|rail/i.test(hay)) {
    icon = '🚄'
    durationLabel = durationFromText || (shortHop ? '약 30분' : '약 2시간')
  } else if (from.cityEn === to.cityEn) {
    icon = '🚇'
    durationLabel = durationFromText || '약 30분'
    lineStyle = 'solid_blue'
  } else if (shortHop && !durationFromText) {
    icon = '🚌'
    durationLabel = '약 1시간'
  }

  return {
    fromCityKo: from.cityKo,
    toCityKo: to.cityKo,
    icon,
    durationLabel,
    lineStyle,
  }
}

export function extractItineraryRouteMapHubs(schedule: ItineraryRouteMapScheduleDay[]): {
  hubs: ItineraryRouteMapHub[]
  legs: ItineraryRouteMapLeg[]
} {
  const sorted = [...schedule]
    .map((d) => ({
      ...d,
      day: Math.floor(Number(d.day)),
    }))
    .filter((d) => Number.isFinite(d.day) && d.day >= 1)
    .sort((a, b) => a.day - b.day)

  const dayHaystacks = new Map<number, string>()
  type Acc = { cityEn: string; cityKo: string; days: number[] }
  const acc: Acc[] = []

  for (const day of sorted) {
    dayHaystacks.set(
      day.day,
      [day.routeText, day.title, day.description, day.city].filter(Boolean).join('\n'),
    )
    const cityEn = cityEnFromDay(day)
    if (!cityEn) continue
    const cityKo = koreanLabelForCity(cityEn, day.routeText)
    const last = acc[acc.length - 1]
    if (last && normCityKey(last.cityEn) === normCityKey(cityEn)) {
      last.days.push(day.day)
      continue
    }
    acc.push({ cityEn, cityKo, days: [day.day] })
  }

  const hubs: ItineraryRouteMapHub[] = acc.map((h) => ({
    cityKo: h.cityKo,
    cityEn: h.cityEn,
    days: h.days,
    dayLabel: formatItineraryRouteMapDayLabel(h.days),
  }))

  const legs: ItineraryRouteMapLeg[] = []
  for (let i = 0; i < hubs.length - 1; i++) {
    legs.push(inferLeg(hubs[i]!, hubs[i + 1]!, dayHaystacks))
  }
  // 귀국/회귀 구간 — 첫·마지막 거점이 다르면 닫는 동선 1개 추가
  if (hubs.length >= 3) {
    const first = hubs[0]!
    const last = hubs[hubs.length - 1]!
    if (normCityKey(first.cityEn) !== normCityKey(last.cityEn)) {
      legs.push({
        fromCityKo: last.cityKo,
        toCityKo: first.cityKo,
        icon: '✈️',
        durationLabel: '약 2시간 30분',
        lineStyle: 'dashed_green',
      })
    }
  }

  return { hubs, legs }
}

export function parseScheduleJsonForRouteMap(
  schedule: string | ItineraryRouteMapScheduleDay[] | null | undefined,
): ItineraryRouteMapScheduleDay[] {
  if (!schedule) return []
  let arr: unknown = schedule
  if (typeof schedule === 'string') {
    try {
      arr = JSON.parse(schedule)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  const out: ItineraryRouteMapScheduleDay[] = []
  for (const row of arr) {
    const r = row as Record<string, unknown>
    const day = Math.floor(Number(r.day))
    if (!Number.isFinite(day) || day < 1) continue
    out.push({
      day,
      title: typeof r.title === 'string' ? r.title : null,
      description: typeof r.description === 'string' ? r.description : null,
      routeText: typeof r.routeText === 'string' ? r.routeText : null,
      city: typeof r.city === 'string' ? r.city : null,
    })
  }
  return out
}
