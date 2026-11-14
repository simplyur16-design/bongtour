/**
 * 도시 이름만 있는 날(예: '두바이 - 아테네' 경유일, '하노이' 귀국일) 판정.
 * 사장님 11/01: 도시만 있는 날은 사진·키워드를 비워 둔다. 단 도시 이름 자체가 명소인 곳
 * (우유니·이과수·카르타고·마트마타 …)은 명소로 본다. 자유일정 날은 추천일정 키워드를 유지(도시만 날 아님).
 */
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'
import { firstMatchingScheduleSpotEn, SCHEDULE_CITY_KO_REGEX_RULES } from '@/lib/schedule-poi-regex-ssot'

/** 도시 이름이 곧 명소인 곳 — 도시만 있는 날로 보지 않는다 */
export const REGISTER_CITY_IS_ATTRACTION_RE =
  /우유니|uyuni|이과수|이구아수|iguazu|igua[çc]u|카르타고|carthage|마트마타|matmata|메테오라|meteora|카파도키아|cappadocia|파묵칼레|pamukkale|할슈타트|hallstatt|하롱|ha\s*long|페트라|petra|마추픽추|machu\s*picchu|산토리니|santorini/i

const NOISE_SEGMENT_RE = /^(?:.*공항.*|.*airport.*|기내(?:\s*숙박)?|이동|경유|출발|도착|귀국|인천|김포|김해|in[\s-]*flight)$/i
const SPLIT_RE = /\s*(?:\s-\s|→|->|>|·|,|\/|\s–\s)\s*/u

function segmentIsBareCity(seg: string): boolean {
  const s = seg.trim()
  if (!s) return false
  if (firstMatchingScheduleSpotEn(s)) return false
  if (isBareCityOrCountryKeyword(s)) return true
  // 한글 도시 한 낱말(2~6자, 공백 없음)이 도시 사전과 맞을 때만 — '아테네 아크로폴리스'는 도시만 아님
  if (/^[가-힣]{2,6}$/u.test(s)) {
    for (const { re } of SCHEDULE_CITY_KO_REGEX_RULES) {
      const m = new RegExp(re.source, re.flags.replace('g', '')).exec(s)
      if (m && m[0] === s) return true
    }
  }
  return false
}

export function registerScheduleRouteIsCityOnly(routeText: string | null | undefined): boolean {
  const t = String(routeText ?? '').trim()
  if (!t) return false
  if (REGISTER_CITY_IS_ATTRACTION_RE.test(t)) return false
  const segs = t.split(SPLIT_RE).map((x) => x.trim()).filter(Boolean)
  if (segs.length === 0) return false
  let cities = 0
  for (const seg of segs) {
    if (segmentIsBareCity(seg)) {
      cities++
      continue
    }
    if (NOISE_SEGMENT_RE.test(seg)) continue
    return false
  }
  return cities > 0
}

/** 일정 요약 칸의 명소·관광지. 도시 이름(아디스 아바바·상파울루)과 공항·이동 말은 제외. */
const NAMED_SIGHT_RE =
  /마운틴|신사|사원|사찰|폭포|해변|비치|시장|성당|타워|공원|광장|박물관|궁전|대교|호수|빙하|온천|구시가|피라미드|협곡|계곡|동굴|워터프런트|유니버설|디즈니|성채|mountain|shrine|temple|glacier|lagoon|beach|bridge|market|palace|falls|waterfall|park|tower|cathedral|mosque|pyramid|canyon|cave/i

/**
 * 일정 요약(route)에 명소·관광지가 있는지.
 * 도시 이름만·공항 이동은 false. 도시 이름이 곧 명소인 곳은 true.
 * REGRESSION-FREEZE[photo-fill-route-sight-1114]: 요약의 명소는 검색 대상 — manifest
 */
export function registerScheduleRouteHasNamedSight(routeText: string | null | undefined): boolean {
  const t = String(routeText ?? '').trim()
  if (!t) return false
  if (REGISTER_CITY_IS_ATTRACTION_RE.test(t)) return true
  const segs = t.split(SPLIT_RE).map((x) => x.trim()).filter(Boolean)
  return segs.some((seg) => {
    if (NOISE_SEGMENT_RE.test(seg)) return false
    if (NAMED_SIGHT_RE.test(seg)) return true
    const en = firstMatchingScheduleSpotEn(seg)
    return !!en && NAMED_SIGHT_RE.test(en)
  })
}

/**
 * 도시만 있는 이동·경유일 — 서로 다른 도시 2곳 이상만 있는 날(예: '두바이 - 아테네').
 * 한 도시에 머무는 날('보르도'·'홍콩')은 그 도시 명소 키워드가 필요하므로 여기에 들지 않는다.
 * REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 머무는 도시 1곳 날은 키워드 강제 유지 — manifest
 */
export function registerScheduleRouteIsCityOnlyTransit(routeText: string | null | undefined): boolean {
  if (!registerScheduleRouteIsCityOnly(routeText)) return false
  const segs = String(routeText ?? '')
    .trim()
    .split(SPLIT_RE)
    .map((x) => x.trim())
    .filter(Boolean)
  const cities = new Set<string>()
  for (const seg of segs) {
    if (NOISE_SEGMENT_RE.test(seg)) continue
    if (segmentIsBareCity(seg)) cities.add(seg.toLowerCase())
  }
  return cities.size >= 2
}

/** 자유일정·추천일정 날 — 도시만 있는 날 규칙을 쓰지 않는다(사장님 11/01 19:01: 자유일정 날은 추천일정 사진 유지) */
const FREE_DAY_TITLE_RE = /추천일정|자유\s*일정/u

/**
 * 사진 비움 판정용 — 도시만 있는 날이면서 자유일정·추천일정 날이 아닐 때만 true.
 * REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 자유일정 날은 도시만 규칙 제외 — manifest
 */
export function registerScheduleDayIsCityOnlyPhotoSkip(day: {
  title?: string | null
  routeText?: string | null
}): boolean {
  if (FREE_DAY_TITLE_RE.test(String(day.title ?? ''))) return false
  return registerScheduleRouteIsCityOnly(day.routeText)
}
