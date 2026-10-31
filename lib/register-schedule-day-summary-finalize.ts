/**
 * 패키지 일정 최종 패스 (post-augment 마지막 단계, 모든 패키지 공급사 공통).
 * 1) 일차 요약(description) — 3~4문장, 한글 지명(영문 도시명 → 한글), 군더더기 closer 문장 제거.
 *    부족한 문장은 그날 데이터(방문지·이동·식사·숙박/기내박·귀국)로만 채운다. 데이터가 없으면 지어내지 않는다.
 * 2) imageKeyword — 그날 일정(제목·routeText)에 있는 장소만. 다른 날 장소면 그날 장소로 교체, 없으면 비운다.
 * 3) hotelText — 기내박은 숙박 없음(기내박).
 * 가격·상품 제목은 다루지 않는다.
 * REGRESSION-FREEZE[register-schedule-day-summary-finalize]: 3–4 sentences·KO place·same-day keywords — manifest
 */
import { stripRegisterScheduleFragmentSentences, stripRegisterScheduleRowFragments } from '@/lib/register-schedule-row-fragment-filter'
import {
  destinationEnKeysInKoreanText,
  koreanCityNameFromEnglish,
  koreanPlaceNameFromEnglish,
  mapKoreanPoiSegment,
  normalizeSemanticPoiKey,
} from '@/lib/pexels-keyword'
import {
  SCHEDULE_CITY_KO_REGEX_RULES,
  SCHEDULE_SPOT_KO_REGEX_RULES,
  englishFromScheduleKoreanSegmentWithRegex,
  findAllScheduleSpotMatchesInText,
} from '@/lib/schedule-poi-regex-ssot'
import {
  REGISTER_SCHEDULE_DESCRIPTION_FACET_CLOSERS,
  splitRegisterScheduleDescriptionSentences,
} from '@/lib/register-schedule-description-characteristic-ssot'
import {
  isRegisterScheduleDomesticHubRouteSegment,
  isRegisterScheduleRoutePlaceNoise,
} from '@/lib/register-schedule-route-place-noise'
import {
  REGISTER_SCHEDULE_INFLIGHT_NO_HOTEL_TEXT,
  normalizeRegisterScheduleDayHotelText,
} from '@/lib/register-schedule-hotel-inflight'
import { isRegisterScheduleLodgingLikeTitleLabel } from '@/lib/register-schedule-day-title'

export type RegisterScheduleFinalizeRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
}

export const REGISTER_SCHEDULE_DAY_SUMMARY_MIN_SENTENCES = 3
export const REGISTER_SCHEDULE_DAY_SUMMARY_MAX_SENTENCES = 4

// ───────────────────────── 한글 지명 ─────────────────────────

let REGEX_EN_TO_KO: Map<string, string> | null = null

/** schedule-poi-regex-ssot 규칙의 `한글|English` 리터럴 대안 → 영문 리터럴을 한글로 */
function regexRuleEnToKo(): Map<string, string> {
  if (REGEX_EN_TO_KO) return REGEX_EN_TO_KO
  const m = new Map<string, string>()
  for (const { re } of [...SCHEDULE_CITY_KO_REGEX_RULES, ...SCHEDULE_SPOT_KO_REGEX_RULES]) {
    const alts = re.source
      .split('|')
      .map((a) => a.replace(/^\^|\$$/g, '').replace(/\\s\*|\\s\+|\\s/g, ' ').trim())
      .filter((a) => a && !/[\\()[\]?*+{}.]/.test(a))
    const ko = alts.find((a) => /^[가-힣 ]+$/u.test(a))
    if (!ko) continue
    for (const a of alts) {
      if (!/^[A-Za-z][A-Za-z '’-]*$/.test(a)) continue
      const key = normalizeSemanticPoiKey(a)
      if (key && !m.has(key)) m.set(key, ko.replace(/\s+/g, ' '))
    }
  }
  REGEX_EN_TO_KO = m
  return m
}

/** 영문 지명 → 한글 (모르면 null) */
export function registerScheduleKoreanPlaceName(en: string | null | undefined): string | null {
  const t = String(en ?? '').trim()
  if (!t || /[가-힣]/u.test(t)) return null
  return koreanPlaceNameFromEnglish(t) ?? regexRuleEnToKo().get(normalizeSemanticPoiKey(t)) ?? null
}

function jongseong(ch: string): number | null {
  const code = ch.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return null
  return (code - 0xac00) % 28
}

/** 치환된 한글 지명 뒤 조사 교정 (Lucerne를 → 루체른을) */
function fixParticleAfter(word: string, particle: string): string {
  const j = jongseong(word.slice(-1))
  const has = j !== null && j !== 0
  switch (particle) {
    case '을':
    case '를':
      return has ? '을' : '를'
    case '이':
    case '가':
      return has ? '이' : '가'
    case '은':
    case '는':
      return has ? '은' : '는'
    case '과':
    case '와':
      return has ? '과' : '와'
    case '으로':
    case '로':
      return has && j !== 8 ? '으로' : '로'
    default:
      return particle
  }
}

/** 문장 안 영문 지명(Lucerne·Cairo·Da Nang)을 한글로 — 모르는 영문(호텔명 등)은 그대로 */
export function koreanizeRegisterSchedulePlaceNames(text: string | null | undefined): string {
  const s = String(text ?? '')
  if (!/[A-Za-z]/.test(s)) return s
  return s.replace(
    /([A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*){0,3})(으로|을|를|이|가|은|는|과|와|로)?/g,
    (whole, words: string, particle: string | undefined) => {
      const ko = registerScheduleKoreanPlaceName(words)
      if (ko) return `${ko}${particle ? fixParticleAfter(ko, particle) : ''}`
      // 두 단어 이하 구만 부분 치환 (호텔명 등 긴 영문 덩어리는 손대지 않음)
      const parts = words.split(/\s+/)
      if (parts.length === 2) {
        const k0 = registerScheduleKoreanPlaceName(parts[0])
        const k1 = registerScheduleKoreanPlaceName(parts[1])
        if (k0 && k1) return `${k0} ${k1}${particle ? fixParticleAfter(k1, particle) : ''}`
      }
      return whole
    },
  )
}

// ───────────────────────── 일차 요약 ─────────────────────────

const FILLER_SENTENCE_RES: readonly RegExp[] = [
  /리듬을\s*맞추며/u,
  /첫날\s*일정을\s*이어갑니다/u,
  /주변을\s*이어서\s*둘러봅니다/u,
  /\d+\s*일차\s*(?:구간|동선)을/u,
  /동선을\s*천천히\s*이어\s*갑니다/u,
  /동선에\s*맞춰\s*하루\s*일정을\s*이어갑니다/u,
  /일정을\s*마무리한\s*뒤\s*귀국\s*이동으로\s*이어갑니다/u,
  /별도의\s*관광보다\s*이동\s*중심으로/u,
  /(?:리듬|감각|스케일|풍경)으로\s*하루를\s*(?:이어갑니다|마무리합니다)/u,
  /구간(?:으로|에서)\s*하루를\s*(?:이어갑니다|마무리합니다)/u,
  /일정을\s*이어서\s*진행합니다/u,
  /하루\s*동안\s*여러\s*장면이|명소\s*나열보다|특정\s*장소보다\s*전체적인/u,
  /마무리\s*일정입니다|차분한\s*리듬/u,
  // round3: 기계적 빈 문구 — 'N일차 구간을 이어서 둘러봅니다'·'구간을 둘러봅니다'
  /구간을\s*(?:이어서\s*)?둘러봅니다/u,
  /일차\s*(?:구간|동선|일정)(?:을|를|으로|에서)/u,
]

/** '둘러봅니다' 목적어로 오면 안 되는 말 — 이동·출발·도착·공항·숙소·식사·자유시간·N일차 (round3) */
const NOT_SIGHT_OBJECT_RE =
  /(?:이동|향발|출발|도착|탑승|경유|입국|출국|귀국|귀환|공항|호텔|리조트|숙소|레지던스|빌라|체크\s*인|체크\s*아웃|뷔페|부페|디너|런치|식사|조식|중식|석식|특식|자유\s*(?:시간|일정)|휴식|\d+\s*일차)/u
const NOT_SIGHT_OBJECT_EXACT_RE = /^(?:구간|동선|일정|시내|주변)$/u

/**
 * 'X와 Y를 둘러봅니다' 합성문에서 장소가 아닌 목적어(공항 이동·숙소명·식사·N일차)를 뺀다.
 * 남는 장소가 없으면 null(문장 버림). 합성문 모양이 아니면 그대로.
 */
function cleanSightseeingSentence(s: string, hotelText: string | null | undefined): string | null {
  const m = /^(.+?)(을|를)\s*(둘러봅니다|이어서\s*방문합니다|방문합니다)\.$/u.exec(s)
  if (!m) return s
  const objs = m[1]!.split(/\s*(?:(?<=[가-힣A-Za-z0-9)])(?:와|과)\s+|,\s*)/u).map((x) => x.trim()).filter(Boolean)
  if (objs.length === 0 || objs.length > 4) return s
  const hotelKey = String(hotelText ?? '').replace(/\s+/g, '').toLowerCase()
  const isHotelName = (o: string) => {
    const k = o.replace(/\s+/g, '').toLowerCase()
    return k.length >= 2 && hotelKey.length >= 2 && hotelKey.includes(k)
  }
  const keep = objs.filter((o) => !NOT_SIGHT_OBJECT_RE.test(o) && !NOT_SIGHT_OBJECT_EXACT_RE.test(o) && !isHotelName(o))
  if (keep.length === objs.length) return s
  if (keep.length === 0) return null
  const verb = m[3]!
  const head = keep.length >= 2 ? waGwa(keep[0]!, keep[1]!) + (keep.length > 2 ? `, ${keep.slice(2).join(', ')}` : '') : keep[0]!
  return `${eulReul(head)} ${verb}.`
}

export function isRegisterScheduleFillerSentence(sentence: string): boolean {
  const t = String(sentence ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (REGISTER_SCHEDULE_DESCRIPTION_FACET_CLOSERS.includes(t)) return true
  return FILLER_SENTENCE_RES.some((re) => re.test(t))
}

function stripParens(s: string): string {
  return s.replace(/\s*[([（][^)\]）]*[)\]）]\s*/gu, ' ').replace(/\s+/g, ' ').trim()
}

function eulReul(w: string): string {
  const j = jongseong(w.slice(-1))
  return j !== null && j !== 0 ? `${w}을` : `${w}를`
}
function waGwa(a: string, b: string): string {
  const j = jongseong(a.slice(-1))
  return j !== null && j !== 0 ? `${a}과 ${b}` : `${a}와 ${b}`
}

const MOVE_SEG_RE = /(?:이동|향발|출발|도착|탑승|경유|입국|출국|귀국|귀환)$/u
/** 상품명·광고 문구가 route 에 섞인 경우 (★대기예약★『…』 8일) — 장소 아님 */
const PRODUCT_TITLE_LIKE_RE = /[★☆『』【】「」]|\d+\s*(?:일|박)(?=\s|$)|\d+\s*박\s*\d+\s*일/u
/** 이동수단·일반 활동 — 장소 아님 */
const GENERIC_NON_PLACE_RE =
  /(?:^|\s)(?:스페셜\s*)?(?:불)?포함$|^(?:도보|도보\s*관광|전용\s*차량|차량|버스|열차|기차|페리|자유\s*(?:시간|일정)|휴식|미팅|가이드\s*미팅|조식|중식|석식|쇼핑)$/u

export function isRegisterScheduleNonPlaceRouteLabel(seg: string): boolean {
  const t = String(seg ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return true
  return PRODUCT_TITLE_LIKE_RE.test(t) || GENERIC_NON_PLACE_RE.test(t)
}

type DayRoute = { places: string[]; moves: string[] }

function dayRouteParts(routeText: string): DayRoute {
  const places: string[] = []
  const moves: string[] = []
  for (const raw of routeText.split(/\s+-\s+/)) {
    const seg = koreanizeRegisterSchedulePlaceNames(stripParens(raw)).replace(/\s*등$/u, '').trim()
    if (!seg || seg.length < 2 || seg.length > 28) continue
    if (/[#※★]|https?:|니다\.?$/u.test(seg)) continue
    if (isRegisterScheduleNonPlaceRouteLabel(seg)) continue
    if (isRegisterScheduleDomesticHubRouteSegment(seg)) continue
    if (isRegisterScheduleLodgingLikeTitleLabel(seg)) continue
    if (MOVE_SEG_RE.test(seg)) {
      if (/이동$/u.test(seg) && /[가-힣]/u.test(seg) && !moves.includes(seg)) moves.push(seg)
      continue
    }
    if (isRegisterScheduleRoutePlaceNoise(seg)) continue
    if (!/[가-힣]/u.test(seg)) continue
    if (!places.includes(seg)) places.push(seg)
  }
  return { places, moves }
}

function mentioned(desc: string, place: string): boolean {
  const d = desc.replace(/\s+/g, '')
  const p = place.replace(/\s+/g, '')
  if (p.length >= 2 && d.includes(p)) return true
  const toks = place.match(/[가-힣]{2,}/gu) ?? []
  return toks.some((t) => t.length >= 3 && d.includes(t))
}

function cleanMeal(v: string | null | undefined): string | null {
  const t = String(v ?? '')
    .replace(/\s*\((?:불포함|유료[^)]*|자유식)\)\s*/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  // 불포함·유료 식사는 '제공 식사'가 아님 — 요약에 쓰지 않음
  if (/불포함|유료|미포함|불가/u.test(t)) return null
  if (!t || t.length > 16) return null
  if (/추천|제공으로|준비|안내|참고|null|undefined/u.test(t)) return null
  if (/^(?:조식|중식|석식)$/u.test(t)) return null
  return t
}

function mealSentence(row: RegisterScheduleFinalizeRow): string | null {
  const b = cleanMeal(row.breakfastText)
  const l = cleanMeal(row.lunchText)
  const d = cleanMeal(row.dinnerText)
  const parts = [b && `조식 ${b}`, l && `중식 ${l}`, d && `석식 ${d}`].filter(Boolean) as string[]
  if (parts.length === 0) return null
  const all = [b, l, d].filter(Boolean)
  if (all.length >= 1 && all.every((x) => x === '기내식')) return '식사는 기내식으로 제공됩니다.'
  return `식사는 ${parts.join(', ')}입니다.`
}

function hotelSentence(row: RegisterScheduleFinalizeRow, isLast: boolean): string | null {
  const h = String(normalizeRegisterScheduleDayHotelText(row.hotelText) ?? '').trim()
  if (!h) return null
  if (h === REGISTER_SCHEDULE_INFLIGHT_NO_HOTEL_TEXT) return '이날은 기내에서 1박합니다.'
  if (/^숙박\s*없음/u.test(h)) return null
  if (isLast) return null
  let name = h.split(/\s+\/\s+/)[0]!.split(/\s*\/\/\s*/)[0]!.trim()
  if (/[가-힣]/u.test(name)) name = stripParens(name)
  if (!name || name.length > 40) return null
  if (/이면|이라면|조건|추후|미정|문의|안내|상세\s*보기|자세히|호텔\s*소개|^보기$/u.test(name)) return null
  if (/예정|확정|동급/u.test(name)) {
    const core = name
      .replace(/\s*\(.*$/u, '')
      .replace(/\s*(?:혹은|또는)?\s*동급(?:\s*호텔)?\s*$/u, '')
      .replace(/\s*(?:예정|확정)\s*(?:호텔|숙소)?\s*$/u, '')
      .replace(/\s*[-–]\s*$/u, '')
      .trim()
    // 이름 없는 '예정 호텔'·지역명만 남으면 문장을 만들지 않음 (지어내지 않음)
    if (!core || core.length < 2 || !/호텔|리조트|hotel|resort|inn|레지던스|[A-Z][a-z]+\s+[A-Z]/iu.test(core)) return null
    return `숙소는 ${core} 또는 동급 호텔입니다.`
  }
  return `숙소는 ${name}입니다.`
}

const DEPARTURE_HUB_RE = /인천|김포|김해|부산|대구|청주|제주|무안|양양/u
/** 원문 출발 정보·1일차 동선에서 실제 출발지 (없으면 null) */
export function registerScheduleDepartureHub(departureText: string, day1Route: string): string | null {
  const t = String(departureText ?? '')
  const m = new RegExp(`(${DEPARTURE_HUB_RE.source})`, 'u').exec(t)
  if (m) return m[1]!
  const first = String(day1Route ?? '').split(/\s+-\s+/)[0] ?? ''
  const m2 = new RegExp(`^(${DEPARTURE_HUB_RE.source})`, 'u').exec(first.trim())
  return m2 ? m2[1]! : null
}
/** 도착지 자리에 올 수 있는 말: 도시·공항만 (안내문·가이드 이름·리조트 이름 금지) */
function isArrivalCityLabel(x: string, knownCities: readonly string[] = []): boolean {
  const t = stripParens(String(x ?? '')).trim()
  if (t && knownCities.includes(t)) return true
  if (!t || t.length > 14) return false
  if (/안내|가이드|미팅|참고|주의|숙소|호텔|리조트|레스토랑|식당|[.,!?:]/u.test(t)) return false
  if (/(?:국제)?공항$/u.test(t)) return true
  const c = koreanCitiesInText(t)
  return c.length > 0 && c[0] === t
}
/**
 * 파싱 단계 틀 문장 '인천에서 출발해 X에서 도착합니다' — 실제 출발지·도시 도착지일 때만 남기고(출발지는 원문 것으로),
 * 아니면 버린다. 귀국 틀 '체크아웃 후 인천으로 귀국합니다' 도 출발지를 원문 것으로 맞춘다.
 */
export function fixDepartureTemplateSentence(s: string, hub: string | null, knownCities: readonly string[] = []): string | null {
  const dep = /^([가-힣]+)에서\s*출발해\s+(.+?)(?:에서|에)\s*도착합니다\.$/u.exec(s)
  if (dep) {
    if (!hub || !isArrivalCityLabel(dep[2]!, knownCities)) return null
    return `${hub}에서 출발해 ${dep[2]}에 도착합니다.`
  }
  const ret = /^체크아웃\s*후\s*([가-힣]+?)(?:으로|로)\s*귀국합니다\.$/u.exec(s)
  if (ret && DEPARTURE_HUB_RE.test(ret[1]!)) {
    if (!hub) return '체크아웃 후 귀국합니다.'
    const j = jongseong(hub.slice(-1))
    return `체크아웃 후 ${hub}${j !== null && j !== 0 && j !== 8 ? '으로' : '로'} 귀국합니다.`
  }
  return s
}

/** 한 일차 요약을 3~4문장으로 정리 */
const GENERIC_RETURN = '귀국편으로 한국에 돌아오며 여행을 마칩니다.'
export function finalizeRegisterScheduleDaySummary(
  row: RegisterScheduleFinalizeRow,
  ctx: {
    maxDay: number
    /** round3: 공급사 원문(파싱 직후) 요약 — 출발·귀국일은 이 문장을 먼저 쓴다 */
    sourceDescription?: string | null
    /** round3: 귀국일 '<도시>에서 출발해 귀국합니다' 의 도시 */
    lastCity?: string | null
    /** round3(21:27): 원문에서 확인된 실제 출발지(인천·청주·김해…). 없으면 출발 틀 문장을 쓰지 않는다 */
    departureHub?: string | null
    /** 상품 목적지 도시(도착지 자리 확인용) */
    destinationCity?: string | null
  },
): string {
  const day = Number(row.day)
  const isFirst = day === 1
  const isLast = ctx.maxDay >= 2 && day === ctx.maxDay
  const route = String(row.routeText ?? '')
  const { places, moves } = dayRouteParts(route)

  const kept: string[] = []
  const edgeDay = isFirst || isLast
  // 출발·귀국일: 파싱 단계 그날 문장 중 출발·도착·귀국 문장만 먼저 (지어내지 않고 원문 그대로)
  // round3(22:16): '○○ 자유일정 추천. A - B를 둘러봅니다.' 처럼 동사 아닌 마침표 문장이 앞 문장에 붙어 통째로 빠지지 않게 마침표로 한 번 더 나눔
  const splitAll = (t: string) =>
    splitRegisterScheduleDescriptionSentences(t).flatMap((x) => x.split(/(?<=[.!?。])\s+/u).map((y) => y.trim()).filter(Boolean))
  const descSents = splitAll(koreanizeRegisterSchedulePlaceNames(String(row.description ?? '')))
  const descHasEdge = descSents.some((x) => /출발|도착|귀국|공항|체크\s*아웃/u.test(x) && !isRegisterScheduleFillerSentence(x) && x.trim() !== GENERIC_RETURN)
  const srcSents = edgeDay && !descHasEdge
    ? splitAll(koreanizeRegisterSchedulePlaceNames(String(ctx.sourceDescription ?? ''))).filter(
        (x) => /출발|도착|귀국|체크\s*아웃/u.test(x),
      )
    : []
  for (const raw of [...srcSents, ...descSents]) {
    const s0 = raw
      .trim()
      .replace(/^\d+\s*일차\s+/u, '')
      .replace(/([가-힣A-Za-z)]+)에서\s+도착합니다/gu, '$1에 도착합니다')
      .replace(
        /([가-힣A-Za-z0-9]+)(?:와|과)\s+(?:도보|차량|전용\s*차량|버스|열차|기차)(?:을|를)\s+둘러봅니다/gu,
        (_m, a: string) => `${eulReul(a)} 둘러봅니다`,
      )
    if (!s0 || isRegisterScheduleFillerSentence(s0)) continue
    const s1 = fixDepartureTemplateSentence(s0, ctx.departureHub ?? null, ctx.destinationCity ? [ctx.destinationCity] : [])
    if (!s1) continue
    const s = cleanSightseeingSentence(s1, row.hotelText)
    if (!s || isRegisterScheduleFillerSentence(s)) continue
    if (/숙박\s*없음(?:을|를|에서|과|와)/u.test(s)) continue
    if (!/[.!?。]$/u.test(s)) continue
    // 상품명·이동 문구를 도착지로 쓴 합성문 (… 입국에서 도착합니다) — 버림
    if (/[★☆『』【】]/u.test(s)) continue
    if (/(?:입국|출국|출발|귀국|이동)에(?:서)?\s*도착합니다/u.test(s)) continue
    const k = s.replace(/\s+/g, '')
    if (kept.some((x) => x.replace(/\s+/g, '') === k)) continue
    kept.push(s)
  }
  // 합성 귀국 문장은 다른 귀국 문장이 있으면 뺀다
  if (kept.includes(GENERIC_RETURN) && kept.some((x) => x !== GENERIC_RETURN && /귀국/u.test(x))) {
    kept.splice(kept.indexOf(GENERIC_RETURN), 1)
  }

  // 숙박 없는 귀국일에 도시 이름만 '둘러봅니다' 하는 합성문(도하를 둘러봅니다) → 출발 문장으로 (round3)
  const lastCityOnly =
    isLast && places.length > 0 && places.every((p) => koreanCitiesInText(p)[0] === p)
  const out = lastCityOnly
    ? kept.filter((s) => {
        const m = /^(.+?)(?:을|를)\s*둘러봅니다\.$/u.exec(s)
        if (!m) return true
        const objs = m[1]!.split(/\s*(?:(?<=[가-힣])(?:와|과)\s+|,\s*)/u).map((x) => x.trim())
        return !objs.every((o) => koreanCitiesInText(o)[0] === o)
      })
    : [...kept]
  const text = () => out.join(' ')
  const extra: string[] = []

  // 첫날 — 출발·도착 (공급사 문장·합성문이 없을 때, 그날 route 근거만)
  // round3(21:27): 원문에 실제 출발지가 있고 도착지가 도시일 때만 — 아니면 틀 문장 없이 원문 문장만
  const hub0 = ctx.departureHub ?? null
  if (isFirst && hub0 && places.length > 0 && !/도착|출발/u.test(text()) && isArrivalCityLabel(places[0]!, ctx.destinationCity ? [ctx.destinationCity] : [])) {
    out.unshift(`${hub0}에서 출발해 ${places[0]}에 도착합니다.`)
  }
  // 방문지 — 요약에 안 나온 그날 장소
  // round3(22:16): 자유일정·자유시간 조각은 'X를 둘러봅니다' 합성 대상이 아님 (제미나이 추천일정이 채움)
  const unmentioned = lastCityOnly ? [] : places.filter((p) => !mentioned(text(), p) && !REGISTER_SCHEDULE_FREE_TIME_RE.test(p))
  if (out.length === 0 && unmentioned.length >= 2) {
    out.push(`${eulReul(waGwa(unmentioned[0]!, unmentioned[1]!))} 둘러봅니다.`)
    unmentioned.splice(0, 2)
  } else if (out.length === 0 && unmentioned.length === 1) {
    out.push(`${eulReul(unmentioned[0]!)} 둘러봅니다.`)
    unmentioned.splice(0, 1)
  }
  if (unmentioned.length > 0) {
    extra.push(`이어서 ${unmentioned.slice(0, 3).join(', ')}도 방문합니다.`)
  }
  // round3: '공항 이동합니다' 같은 이동 문장은 요약이 비었을 때만 (짧으면 짧게 둔다)
  if (out.length === 0) {
    for (const m of moves) {
      if (mentioned(text(), m)) continue
      extra.push(`${m}합니다.`)
      break
    }
  }
  const hotel = hotelSentence(row, isLast)
  if (hotel) extra.push(hotel)
  if (isLast && !/귀국|인천|한국/u.test(text())) {
    const city = String(ctx.lastCity ?? '').trim()
    extra.push(city ? `${city}에서 출발해 귀국합니다.` : '귀국편으로 한국에 돌아오며 여행을 마칩니다.')
  }
  const meal = mealSentence(row)
  if (meal) extra.push(meal)

  for (const e of extra) {
    if (out.some((x) => x.replace(/\s+/g, '') === e.replace(/\s+/g, ''))) continue
    if (e === hotel && out.some((x) => /^숙소는\s/u.test(x))) continue
    if (e === meal && out.some((x) => /^식사는\s/u.test(x))) continue
    if (out.length >= REGISTER_SCHEDULE_DAY_SUMMARY_MAX_SENTENCES) break
    if (out.length >= REGISTER_SCHEDULE_DAY_SUMMARY_MIN_SENTENCES && e === meal) break
    out.push(e)
  }
  return out.slice(0, REGISTER_SCHEDULE_DAY_SUMMARY_MAX_SENTENCES).join(' ').trim()
}

// ───────────────────────── 이미지 키워드 ─────────────────────────

const GENERIC_KW_WORDS = new Set([
  'the', 'and', 'of', 'old', 'town', 'city', 'view', 'night', 'skyline', 'temple', 'temples', 'palace', 'museum',
  'park', 'beach', 'island', 'islands', 'square', 'street', 'tower', 'bridge', 'lake', 'river', 'cathedral', 'church',
  'market', 'garden', 'gardens', 'national', 'wide', 'angle', 'landmark', 'scenic', 'area', 'cruise', 'port', 'hopping',
  'tour', 'district', 'center', 'centre', 'gate', 'castle', 'mountain', 'hill', 'hills', 'valley', 'bay', 'sea',
])

function kwWords(kw: string): string[] {
  return normalizeSemanticPoiKey(kw)
    .split(' ')
    .filter((w) => w.length >= 4 && !GENERIC_KW_WORDS.has(w))
}

type DayPlaces = { text: string; en: string[] }

/**
 * 키워드 앞머리의 도시 수식어(예: 'Kota Kinabalu island hopping')가 이 상품 일정 어디에도 없는 도시면 떼어 냄.
 * 일반 활동 매핑(아일랜드 호핑 → 특정 도시)이 다른 나라 도시를 끌어오는 문제 — 단어 예외가 아니라 상품 텍스트 대조.
 */
function cityAppearsInProduct(head: string, productTextKo: string): boolean {
  const ko = koreanCityNameFromEnglish(head)
  if (!ko) return true
  const headKey = normalizeSemanticPoiKey(head)
  if (productTextKo.replace(/\s+/g, '').includes(ko.replace(/\s+/g, ''))) return true
  if (destinationEnKeysInKoreanText(productTextKo).has(headKey)) return true
  if (new RegExp(`\\b${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(productTextKo)) return true
  for (const { re, en } of SCHEDULE_CITY_KO_REGEX_RULES) {
    if (normalizeSemanticPoiKey(en) === headKey && re.test(productTextKo)) return true
  }
  return false
}

/**
 * 키워드 앞·뒤 도시 수식어(예: 'Kota Kinabalu island hopping', 'Blue Lagoon Vang Vieng')가
 * 이 상품 일정 어디에도 없는 도시면 떼어 냄. 일반 활동·동명 명소 매핑이 다른 나라 도시를 끌어오는 문제 —
 * 단어 예외가 아니라 상품 텍스트 대조로 판정.
 */
export function stripForeignCityQualifierFromKeyword(kw: string, productTextKo: string): string {
  let words = String(kw ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return words.join(' ')
  for (const n of [3, 2, 1]) {
    if (words.length <= n) continue
    const head = words.slice(0, n).join(' ')
    if (!koreanCityNameFromEnglish(head)) continue
    if (!cityAppearsInProduct(head, productTextKo)) words = words.slice(n)
    break
  }
  for (const n of [3, 2, 1]) {
    if (words.length <= n) continue
    const tail = words.slice(words.length - n).join(' ')
    if (!koreanCityNameFromEnglish(tail)) continue
    if (!cityAppearsInProduct(tail, productTextKo)) words = words.slice(0, words.length - n)
    break
  }
  return words.join(' ')
}

function dayPlaces(row: RegisterScheduleFinalizeRow, productTextKo: string): DayPlaces {
  const title = String(row.title ?? '')
  const route = String(row.routeText ?? '')
  const text = koreanizeRegisterSchedulePlaceNames(`${title} - ${route}`)
  const en: string[] = []
  const push = (e: string | null | undefined) => {
    const t = stripForeignCityQualifierFromKeyword(String(e ?? '').trim(), productTextKo)
    if (t && !en.includes(t)) en.push(t)
  }
  for (const seg of text.split(/\s+-\s+|\s+·\s+/)) {
    const s = stripParens(seg)
    if (!s || isRegisterScheduleDomesticHubRouteSegment(s) || isRegisterScheduleLodgingLikeTitleLabel(s)) continue
    push(englishFromScheduleKoreanSegmentWithRegex(s))
    push(mapKoreanPoiSegment(s))
  }
  for (const h of findAllScheduleSpotMatchesInText(text)) push(h.en)
  for (const { re, en: e } of SCHEDULE_CITY_KO_REGEX_RULES) if (re.test(text)) push(e)
  return { text, en }
}

/** 키워드 전체가 그날 장소와 같은 말(포함 관계)인가 — 단어 하나 겹침(Dragon·Mountain)은 제외 */
function keywordStrongInDay(kw: string, dp: DayPlaces): boolean {
  const k = normalizeSemanticPoiKey(kw)
  if (!k) return false
  for (const e of dp.en) {
    const n = normalizeSemanticPoiKey(e)
    if (!n) continue
    if (n === k || (n.length >= 4 && k.includes(n)) || (k.length >= 4 && n.includes(k))) return true
  }
  const ko = registerScheduleKoreanPlaceName(kw)
  return Boolean(ko && ko.length >= 2 && dp.text.includes(ko))
}

/** 나라·지역 이름 낱말 — 이것만 겹쳐서는 '그날 장소'로 보지 않는다 (round3: 'Abu Simbel Temples Egypt') */
const COUNTRY_REGION_KW_WORDS = new Set([
  'egypt', 'vietnam', 'japan', 'china', 'thailand', 'italy', 'france', 'spain', 'portugal', 'switzerland', 'swiss',
  'germany', 'austria', 'czech', 'hungary', 'croatia', 'greece', 'turkey', 'turkiye', 'morocco', 'jordan', 'laos',
  'cambodia', 'philippines', 'malaysia', 'indonesia', 'singapore', 'brunei', 'taiwan', 'mongolia', 'america', 'canada',
  'australia', 'zealand', 'iceland', 'norway', 'sweden', 'finland', 'denmark', 'hokkaido', 'kyushu', 'honshu', 'england',
  'scotland', 'ireland', 'korea', 'india', 'nepal', 'peru', 'mexico', 'brazil', 'argentina', 'chile', 'dubai', 'europe',
])

/** 키워드 앞·뒤의 도시·나라 수식어 낱말 (Phu Quoc Grand World → phu·quoc) */
function keywordQualifierWords(kw: string): Set<string> {
  const out = new Set<string>()
  const words = String(kw ?? '').trim().split(/\s+/).filter(Boolean)
  for (const w of words) if (COUNTRY_REGION_KW_WORDS.has(normalizeSemanticPoiKey(w))) out.add(normalizeSemanticPoiKey(w))
  for (const n of [3, 2, 1]) {
    if (words.length <= n) continue
    const head = words.slice(0, n).join(' ')
    if (koreanCityNameFromEnglish(head)) {
      for (const w of normalizeSemanticPoiKey(head).split(' ')) out.add(w)
      break
    }
  }
  for (const n of [3, 2, 1]) {
    if (words.length <= n) continue
    const tail = words.slice(words.length - n).join(' ')
    if (koreanCityNameFromEnglish(tail)) {
      for (const w of normalizeSemanticPoiKey(tail).split(' ')) out.add(w)
      break
    }
  }
  return out
}

function keywordInDay(kw: string, dp: DayPlaces): boolean {
  if (keywordStrongInDay(kw, dp)) return true
  const qual = keywordQualifierWords(kw)
  const all = kwWords(kw)
  const core = all.filter((w) => !qual.has(w))
  // 도시·나라 수식어만 겹치면(Phu Quoc ○○, ○○ Egypt) 그날 장소가 아님 — 본 이름 낱말이 겹쳐야 한다
  const noCountry = all.filter((w) => !COUNTRY_REGION_KW_WORDS.has(w))
  const kws = core.length > 0 ? core : noCountry.length > 0 ? noCountry : all
  const dayWords = new Set(dp.en.flatMap(kwWords))
  if (kws.some((w) => dayWords.has(w))) return true
  // 영문 키워드의 한글 지명이 그날 텍스트에 있으면 인정
  const ko = registerScheduleKoreanPlaceName(kw)
  if (ko && dp.text.includes(ko)) return true
  for (const w of kw.split(/\s+/)) {
    if (core.length > 0 && qual.has(normalizeSemanticPoiKey(w))) continue
    const kw1 = registerScheduleKoreanPlaceName(w)
    if (kw1 && kw1.length >= 2 && dp.text.includes(kw1)) return true
  }
  return false
}

const AIRPORT_KW_RE = /\bairport\b|공항/iu

/** 키워드가 일정상 특정 장소(다른 날 또는 SSOT 지명)로 식별되는가 — 모르는 서술형 키워드는 false */
function keywordIsIdentifiablePlace(kw: string, others: DayPlaces[]): boolean {
  if (others.some((o) => keywordStrongInDay(kw, o))) return true
  if (registerScheduleKoreanPlaceName(kw)) return true
  return kw.split(/\s+/).some((w) => w.length >= 4 && registerScheduleKoreanPlaceName(w))
}

/**
 * imageKeyword / imageKeyword2 — 그날 일정의 장소만.
 * - 그날 장소 → 유지
 * - 다른 날(또는 일정에 없는) 식별 가능한 장소 → 그날 후보로 교체, 후보가 없으면 비움
 * - 출발·귀국일의 목적지 도시 키워드(그날 route 가 허브/빈칸)는 기존 설계대로 유지
 * - 식별 불가 서술형 키워드는 유지 (판정 불가)
 */
export function restrictRegisterScheduleImageKeywordsToSameDay<T extends RegisterScheduleFinalizeRow>(
  rows: T[],
): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const productTextKo = koreanizeRegisterSchedulePlaceNames(
    days.map((r) => `${r.title ?? ''} ${r.routeText ?? ''} ${r.description ?? ''} ${r.hotelText ?? ''}`).join(' '),
  )
  const dps = new Map<number, DayPlaces>()
  for (const r of days) dps.set(Number(r.day), dayPlaces(r, productTextKo))
  const used = new Set<string>()
  for (const r of days) {
    for (const k of [r.imageKeyword, r.imageKeyword2]) {
      const n = normalizeSemanticPoiKey(String(k ?? ''))
      if (n) used.add(n)
    }
  }
  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const dp = dps.get(day)!
    const others = [...dps.entries()].filter(([d]) => d !== day).map(([, v]) => v)
    const edge = day === 1 || day === maxDay
    const routeEmptyOrHub =
      !String(row.routeText ?? '').trim() || dayRouteParts(String(row.routeText ?? '')).places.length === 0
    // 그날 후보 — 공항보다 명소·도시 우선
    const nonAirport = dp.en.filter((e) => !AIRPORT_KW_RE.test(e))
    const replaceWithDayPlace = (allowAirport: boolean): string => {
      const ordered = allowAirport ? [...nonAirport, ...dp.en.filter((e) => AIRPORT_KW_RE.test(e))] : nonAirport
      const cand = ordered.find((e) => !used.has(normalizeSemanticPoiKey(e)))
      if (cand) {
        used.add(normalizeSemanticPoiKey(cand))
        return cand
      }
      // 대표 키워드는 비우지 않는다 — 다른 날과 겹쳐도 그날 장소(예: 연태 일정의 Qingdao → 연태)
      return primarySlot ? (ordered[0] ?? '') : ''
    }
    const pick = (kw: string): string => {
      const t = stripForeignCityQualifierFromKeyword(kw.trim(), productTextKo)
      if (!t) return ''
      // round3: 공항은 도착일·출발일에만 — 그날 명소가 있으면 명소를 먼저 (New Chitose Airport → 시코츠 호수)
      if (AIRPORT_KW_RE.test(t)) {
        if (!edge) return replaceWithDayPlace(false)
        const sight = nonAirport.find((e) => !used.has(normalizeSemanticPoiKey(e)) && !koreanCityNameFromEnglish(e))
        if (sight) {
          used.add(normalizeSemanticPoiKey(sight))
          return sight
        }
        return t
      }
      if (keywordInDay(t, dp)) return t
      if (edge && routeEmptyOrHub && t.split(/\s+/).length <= 2) return t
      // round3: 보조 키워드(kw2)는 그날 장소로 확인되지 않으면 버린다 (Gemini 사후 검사)
      if (!primarySlot && !keywordIsIdentifiablePlace(t, others)) return ''
      if (!keywordIsIdentifiablePlace(t, others)) return t
      return replaceWithDayPlace(edge)
    }
    let primarySlot = true
    const kw1 = pick(String(row.imageKeyword ?? ''))
    primarySlot = !kw1
    let kw2 = pick(String(row.imageKeyword2 ?? ''))
    if (kw2 && normalizeSemanticPoiKey(kw2) === normalizeSemanticPoiKey(kw1)) kw2 = ''
    const primary = kw1 || kw2
    const secondary = kw1 ? kw2 : ''
    if (primary === String(row.imageKeyword ?? '') && (secondary || null) === (row.imageKeyword2 ?? null)) return row
    return { ...row, imageKeyword: primary, imageKeyword2: secondary || null }
  })
}

// ───────────────────────── 최종 패스 ─────────────────────────

/** 제목이 그날 숙소명과 같은지 — `Fairmont Nile City, Cairo` 처럼 호텔 단어가 없는 숙소명 제목 */
function titleIsDayHotelName(title: string, hotelText: string | null | undefined): boolean {
  const key = (s: string) => s.replace(/[\s·,，()（）\[\]_]/gu, '').toLowerCase()
  const t = key(title)
  if (!t) return false
  return String(hotelText ?? '')
    .split(/\s*\/\s*/u)
    .map(key)
    .some((h) => h.length >= 4 && h === t)
}

const COUNTRY_KO_RE =
  /^(?:스위스|프랑스|이탈리아|이태리|스페인|포르투갈|영국|독일|오스트리아|체코|헝가리|크로아티아|그리스|튀르키예|터키|이집트|모로코|요르단|베트남|태국|라오스|캄보디아|필리핀|말레이시아|인도네시아|싱가포르|브루나이|일본|중국|대만|몽골|미국|캐나다|호주|뉴질랜드|아이슬란드|노르웨이|스웨덴|핀란드|덴마크|발트3국|북유럽|동유럽|서유럽|남미|중남미|미지정|여행일정)$/u

/** 글 속 도시(한글) — 나온 순서대로. DESTINATION_MAP 한글 키 + 도시 정규식 규칙의 한글 매치. 나라 이름은 제외 */
function koreanCitiesInText(text: string): string[] {
  const t = String(text ?? '')
  if (!t.trim()) return []
  const found: Array<{ ko: string; idx: number }> = []
  for (const key of destinationEnKeysInKoreanText(t)) {
    const ko = koreanCityNameFromEnglish(key)
    if (!ko) continue
    const idx = t.indexOf(ko)
    if (idx >= 0) found.push({ ko, idx })
  }
  for (const { re } of SCHEDULE_CITY_KO_REGEX_RULES) {
    const m = new RegExp(re.source, re.flags.replace(/g/g, '')).exec(t)
    if (!m || !/^[가-힣]{2,8}$/u.test(m[0])) continue
    found.push({ ko: m[0], idx: m.index })
  }
  const out: string[] = []
  for (const f of found.sort((a, b) => a.idx - b.idx)) {
    if (COUNTRY_KO_RE.test(f.ko) || isRegisterScheduleDomesticHubRouteSegment(f.ko)) continue
    if (!out.includes(f.ko)) out.push(f.ko)
  }
  return out
}

/** 영문 숙소명 속 도시 (HOLIDAY INN STUTTGART → 모르면 null) */
function koreanCityInEnglishText(text: string | null | undefined): string | null {
  const words = String(text ?? '').replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  for (const n of [2, 1]) {
    for (let i = 0; i + n <= words.length; i++) {
      const ko = koreanCityNameFromEnglish(words.slice(i, i + n).join(' '))
      if (ko && !COUNTRY_KO_RE.test(ko)) return ko
    }
  }
  return null
}

/** 상품 목적지 → 제목에 쓸 도시 이름 (여러 줄·쉼표면 첫 조각, 이상한 값이면 null) */
export function registerScheduleDestinationCityLabel(destination: string | null | undefined): string | null {
  const first = String(destination ?? '').split(/[\n,，/·]/u)[0]?.trim() ?? ''
  if (!first || first.length > 12 || /\d/.test(first) || !/^[가-힣\s]+$/u.test(first)) return null
  if (/^(?:미지정|여행일정|해외|국내)$/u.test(first)) return null
  return first
}

/** 그날 도시: route·제목 속 도시 → 숙소명 속 도시 → 그날 키워드가 도시면 그 도시 */
function dayCityLabel(row: RegisterScheduleFinalizeRow): string | null {
  const cities = koreanCitiesInText(koreanizeRegisterSchedulePlaceNames(`${row.routeText ?? ''} - ${row.title ?? ''}`))
  if (cities[0]) return cities[0]
  const hotelCity = /[가-힣]/u.test(String(row.hotelText ?? ''))
    ? koreanCitiesInText(String(row.hotelText ?? ''))[0] ?? null
    : koreanCityInEnglishText(row.hotelText)
  if (hotelCity) return hotelCity
  const kwCity = koreanCityNameFromEnglish(String(row.imageKeyword ?? '').trim())
  return kwCity && !COUNTRY_KO_RE.test(kwCity) ? kwCity : null
}

/** 귀국일 제목 자리: '귀국'·'숙박 없음(귀국)'·빈칸·N일차·숙소 문구 */
function isReturnDayPlaceholderTitle(t: string): boolean {
  return (
    !t ||
    /^(?:귀국|귀국일|귀국\s*일정|인천\s*(?:도착|귀국)|한국\s*도착)$/u.test(t) ||
    /^숙박\s*없음/u.test(t) ||
    /^\d+\s*일차$/u.test(t)
  )
}

/**
 * 자리표시·빈 제목·UI 문구·숙소명 제목 → 그날 route 의 첫 한글 장소 → 그날 도시 → 상품 목적지 도시.
 * 'N일차', '', '상세보기', 숙소명(그날 hotelText 와 같은 말) 모두 제목으로 남기지 않는다.
 * 귀국일(숙박 없음·'귀국')은 '<마지막 도시> 출발 · 귀국' (round3).
 */
function fillPlaceholderDayTitle(
  row: RegisterScheduleFinalizeRow,
  ctx: { isLast: boolean; destinationCity: string | null; lastCity: string | null },
): string | null | undefined {
  const t = String(row.title ?? '').trim()
  if (ctx.isLast && isReturnDayPlaceholderTitle(t)) {
    const city = ctx.lastCity ?? dayCityLabel(row) ?? ctx.destinationCity
    if (city) return `${city} 출발 · 귀국`
  }
  const placeholder =
    !t ||
    /^\d+\s*일차$/u.test(t) ||
    /^(?:상세\s*보기|자세히\s*보기|더\s*보기)$/u.test(t) ||
    isRegisterScheduleLodgingLikeTitleLabel(t) ||
    titleIsDayHotelName(t, row.hotelText)
  if (!placeholder) return row.title
  const { places } = dayRouteParts(String(row.routeText ?? ''))
  // round3(22:16): 자유일정 날은 도시 제목만 남기지 않는다 — 원문 자유일정 조각을 제목에 둔다
  const freeSeg = String(row.routeText ?? '')
    .split(/\s+-\s+/u)
    .map((x) => x.trim())
    .find((x) => REGISTER_SCHEDULE_FREE_TIME_RE.test(x))
  if (freeSeg) {
    const city = places.find((p) => !REGISTER_SCHEDULE_FREE_TIME_RE.test(p)) ?? dayCityLabel(row) ?? ctx.destinationCity
    return city && !freeSeg.includes(city) ? `${city} · ${freeSeg}` : freeSeg
  }
  return places[0] ?? dayCityLabel(row) ?? ctx.destinationCity ?? row.title
}

/**
 * 귀국일 출발 도시: 그날 route 의 도시 → 그날 route 의 짧은 단일 장소 → 전날 route·제목의 마지막 도시 → 목적지 도시.
 */
function returnDayCity<T extends RegisterScheduleFinalizeRow>(rows: T[], maxDay: number, destinationCity: string | null): string | null {
  const last = rows.find((r) => Number(r.day) === maxDay)
  if (last) {
    const route = koreanizeRegisterSchedulePlaceNames(String(last.routeText ?? ''))
    // round3: 귀국일 동선의 도시는 다른 날 동선에도 도시 칸으로 나오거나 목적지 도시일 때만 (대소석림 같은 명소 제외)
    const otherCitySegs = new Set(
      rows
        .filter((r) => Number(r.day) !== maxDay)
        .flatMap((r) => koreanizeRegisterSchedulePlaceNames(String(r.routeText ?? '')).split(/\s+-\s+/).map((x) => stripParens(x).trim())),
    )
    const c = koreanCitiesInText(route).filter((x) => x === destinationCity || otherCitySegs.has(x))
    if (c.length) return c[c.length - 1]!
    // round3: 명소 이름(대소석림)을 귀국 도시로 쓰지 않는다 — 도시로 확인되는 것만
  }
  // 그날 키워드가 도시면 그 도시 (Cairo → 카이로)
  if (last) {
    const kwCity = koreanCityNameFromEnglish(String(last.imageKeyword ?? '').trim())
    if (kwCity && !COUNTRY_KO_RE.test(kwCity)) return kwCity
  }
  // 전날 route 에서 도시만 있는 칸(‘기자 피라미드’ 속 ‘기자’ 같은 명소 일부는 제외)
  const prev = rows.find((r) => Number(r.day) === maxDay - 1)
  if (prev) {
    const segs = koreanizeRegisterSchedulePlaceNames(String(prev.routeText ?? '')).split(/\s+-\s+/).map((x) => stripParens(x))
    const cityOnly = segs.filter((x) => koreanCitiesInText(x)[0] === x || (!!destinationCity && x === destinationCity))
    if (cityOnly.length) return cityOnly[cityOnly.length - 1]!
  }
  return destinationCity
}

/**
 * 사진을 붙이지 않는 '장소 없는 날' (round3): 그날 route 에 장소가 없거나(공항 이동·출발만),
 * 숙박 없는 귀국일에 도시 이름만 있는 날.
 * REGRESSION-FREEZE[register-photo-no-place-day]: 장소 없는 날·숙박 없는 귀국일 사진 제외 — manifest
 */
/** 자유일정·자유시간·자유관광·반나절/전일 자유 (호텔 부대시설 이용 및 자유시간 포함) */
export const REGISTER_SCHEDULE_FREE_TIME_RE = /자유\s*(?:일정|시간|관광|여행|투어)|(?:반나절|전일|하루|종일|오전|오후)\s*자유|free\s*(?:day|time)/iu

export function isRegisterScheduleNoPlacePhotoDay(
  row: Pick<RegisterScheduleFinalizeRow, 'day' | 'title' | 'routeText' | 'hotelText'>,
  maxDay: number,
): boolean {
  const route = String(row.routeText ?? '').trim()
  const parts = dayRouteParts(route || String(row.title ?? '').replace(/\s*출발\s*·\s*귀국$/u, ''))
  // REGRESSION-FREEZE[register-photo-no-place-day]: 반나절·하루 자유일정이 있는 날은 장소 없는 날이 아님(제미나이 추천일정·키워드 사진 대상, 사장님 10/30) — manifest
  if (REGISTER_SCHEDULE_FREE_TIME_RE.test(`${row.title ?? ''} ${route}`)) return false
  const places = parts.places.filter((p) => !/공항|airport/iu.test(p))
  if (places.length === 0) return true
  const day = Number(row.day)
  if (maxDay >= 2 && day === maxDay) {
    const h = String(normalizeRegisterScheduleDayHotelText(row.hotelText) ?? '').trim()
    const noStay = !h || /^숙박\s*없음/u.test(h) || h === REGISTER_SCHEDULE_INFLIGHT_NO_HOTEL_TEXT
    if (noStay) {
      const cities = new Set(koreanCitiesInText(places.join(' - ')))
      const onlyCities = places.every((p) => cities.has(p) || (/^[가-힣]{2,5}$/u.test(p) && koreanCitiesInText(p).length > 0))
      if (onlyCities) return true
    }
  }
  return false
}

export type FinalizeRegisterPackageScheduleOpts = {
  /** 상품 목적지(primaryDestination ?? destination) — 제목에 넣을 장소·도시가 없을 때 마지막 대안 */
  destination?: string | null
  /** 파싱 직후 schedule — 출발·귀국일 공급사 원문 요약 */
  sourceRows?: ReadonlyArray<Pick<RegisterScheduleFinalizeRow, 'day' | 'description'>> | null
  /** round3(21:27): 원문 출발 정보(미팅·출국 항공) — 실제 출발지(인천·청주·김해…) 확인용 */
  departureText?: string | null
}

export function finalizeRegisterPackageScheduleRows<T extends RegisterScheduleFinalizeRow>(
  rows: T[],
  opts: FinalizeRegisterPackageScheduleOpts = {},
): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const destinationCity = registerScheduleDestinationCityLabel(opts.destination)
  const normalized = rows.map((row) => {
    if (Number(row.day) <= 0) return row
    const next: T = { ...row }
    if (row.hotelText != null && String(row.hotelText).trim()) {
      next.hotelText = normalizeRegisterScheduleDayHotelText(row.hotelText)
    }
    if (row.routeText && /[A-Za-z]/.test(row.routeText)) {
      next.routeText = koreanizeRegisterSchedulePlaceNames(row.routeText)
    }
    // REGRESSION-FREEZE[register-schedule-row-fragment-filter]: 안내문·요금 조각·숙소명 제목·깨진 제목 제거 (조각만, 문장 생성 없음) — manifest
    return stripRegisterScheduleRowFragments(next)
  })
  const lastCity = maxDay >= 2 ? returnDayCity(normalized, maxDay, destinationCity) : null
  const day1 = normalized.find((r) => Number(r.day) === 1)
  const departureHub = registerScheduleDepartureHub(String(opts.departureText ?? ''), String(day1?.routeText ?? ''))
  const prepared = normalized.map((row) => {
    if (Number(row.day) <= 0) return row
    const title = fillPlaceholderDayTitle(row, { isLast: maxDay >= 2 && Number(row.day) === maxDay, destinationCity, lastCity })
    return title !== row.title ? { ...row, title } : row
  })
  const keyed = restrictRegisterScheduleImageKeywordsToSameDay(prepared)
  return keyed.map((row) => {
    if (Number(row.day) <= 0) return row
    const srcRaw = opts.sourceRows?.find((r) => Number(r.day) === Number(row.day))?.description ?? null
    const src = srcRaw == null ? null : stripRegisterScheduleFragmentSentences(srcRaw)
    const description = finalizeRegisterScheduleDaySummary(row, { maxDay, sourceDescription: src, lastCity, departureHub, destinationCity })
    return description === String(row.description ?? '') ? row : { ...row, description }
  })
}

