/**
 * 패키지 일정 최종 패스 (post-augment 마지막 단계, 모든 패키지 공급사 공통).
 * 1) 일차 요약(description) — 3~4문장, 한글 지명(영문 도시명 → 한글), 군더더기 closer 문장 제거.
 *    부족한 문장은 그날 데이터(방문지·이동·식사·숙박/기내박·귀국)로만 채운다. 데이터가 없으면 지어내지 않는다.
 * 2) imageKeyword — 그날 일정(제목·routeText)에 있는 장소만. 다른 날 장소면 그날 장소로 교체, 없으면 비운다.
 * 3) hotelText — 기내박은 숙박 없음(기내박).
 * 가격·상품 제목은 다루지 않는다.
 * REGRESSION-FREEZE[register-schedule-day-summary-finalize]: 3–4 sentences·KO place·same-day keywords — manifest
 */
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
]

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

/** 한 일차 요약을 3~4문장으로 정리 */
export function finalizeRegisterScheduleDaySummary(
  row: RegisterScheduleFinalizeRow,
  ctx: { maxDay: number },
): string {
  const day = Number(row.day)
  const isFirst = day === 1
  const isLast = ctx.maxDay >= 2 && day === ctx.maxDay
  const route = String(row.routeText ?? '')
  const { places, moves } = dayRouteParts(route)

  const kept: string[] = []
  for (const raw of splitRegisterScheduleDescriptionSentences(
    koreanizeRegisterSchedulePlaceNames(String(row.description ?? '')),
  )) {
    const s = raw
      .trim()
      .replace(/([가-힣A-Za-z)]+)에서\s+도착합니다/gu, '$1에 도착합니다')
      .replace(
        /([가-힣A-Za-z0-9]+)(?:와|과)\s+(?:도보|차량|전용\s*차량|버스|열차|기차)(?:을|를)\s+둘러봅니다/gu,
        (_m, a: string) => `${eulReul(a)} 둘러봅니다`,
      )
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

  const out = [...kept]
  const text = () => out.join(' ')
  const extra: string[] = []

  // 첫날 — 도착 도시 (공급사 문장·합성문이 없을 때)
  if (isFirst && places.length > 0 && !/도착/u.test(text())) {
    out.unshift(`${places[0]}에 도착합니다.`)
  }
  // 방문지 — 요약에 안 나온 그날 장소
  const unmentioned = places.filter((p) => !mentioned(text(), p))
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
  for (const m of moves) {
    if (mentioned(text(), m)) continue
    extra.push(`${m}합니다.`)
    break
  }
  const hotel = hotelSentence(row, isLast)
  if (hotel) extra.push(hotel)
  if (isLast && !/귀국|인천|한국/u.test(text())) extra.push('귀국편으로 한국에 돌아오며 여행을 마칩니다.')
  const meal = mealSentence(row)
  if (meal) extra.push(meal)

  for (const e of extra) {
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

function keywordInDay(kw: string, dp: DayPlaces): boolean {
  if (keywordStrongInDay(kw, dp)) return true
  const kws = kwWords(kw)
  const dayWords = new Set(dp.en.flatMap(kwWords))
  if (kws.some((w) => dayWords.has(w))) return true
  // 영문 키워드의 한글 지명이 그날 텍스트에 있으면 인정
  const ko = registerScheduleKoreanPlaceName(kw)
  if (ko && dp.text.includes(ko)) return true
  for (const w of kw.split(/\s+/)) {
    const kw1 = registerScheduleKoreanPlaceName(w)
    if (kw1 && kw1.length >= 2 && dp.text.includes(kw1)) return true
  }
  return false
}

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
    const pick = (kw: string): string => {
      const t = stripForeignCityQualifierFromKeyword(kw.trim(), productTextKo)
      if (!t) return ''
      if (keywordInDay(t, dp)) return t
      if (edge && routeEmptyOrHub && t.split(/\s+/).length <= 2) return t
      if (!keywordIsIdentifiablePlace(t, others)) return t
      // 그날 후보 — 공항보다 명소·도시 우선
      const ordered = [...dp.en.filter((e) => !/\bairport\b/i.test(e)), ...dp.en.filter((e) => /\bairport\b/i.test(e))]
      const cand = ordered.find((e) => !used.has(normalizeSemanticPoiKey(e)))
      if (cand) {
        used.add(normalizeSemanticPoiKey(cand))
        return cand
      }
      // 대표 키워드는 비우지 않는다 — 다른 날과 겹쳐도 그날 장소(예: 연태 일정의 Qingdao → 연태)
      return primarySlot ? (ordered[0] ?? '') : ''
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

/**
 * 자리표시·빈 제목·UI 문구·숙소명 제목 → 그날 route 의 첫 한글 장소 (없으면 그대로).
 * 'N일차', '', '상세보기', 숙소명(그날 hotelText 와 같은 말) 모두 제목으로 남기지 않는다.
 */
function fillPlaceholderDayTitle(row: RegisterScheduleFinalizeRow): string | null | undefined {
  const t = String(row.title ?? '').trim()
  const placeholder =
    !t ||
    /^\d+\s*일차$/u.test(t) ||
    /^(?:상세\s*보기|자세히\s*보기|더\s*보기)$/u.test(t) ||
    isRegisterScheduleLodgingLikeTitleLabel(t) ||
    titleIsDayHotelName(t, row.hotelText)
  if (!placeholder) return row.title
  const { places } = dayRouteParts(String(row.routeText ?? ''))
  return places[0] ?? row.title
}

export function finalizeRegisterPackageScheduleRows<T extends RegisterScheduleFinalizeRow>(rows: T[]): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const prepared = rows.map((row) => {
    if (Number(row.day) <= 0) return row
    const next: T = { ...row }
    if (row.hotelText != null && String(row.hotelText).trim()) {
      next.hotelText = normalizeRegisterScheduleDayHotelText(row.hotelText)
    }
    if (row.routeText && /[A-Za-z]/.test(row.routeText)) {
      next.routeText = koreanizeRegisterSchedulePlaceNames(row.routeText)
    }
    const title = fillPlaceholderDayTitle(next)
    if (title !== next.title) next.title = title
    return next
  })
  const keyed = restrictRegisterScheduleImageKeywordsToSameDay(prepared)
  return keyed.map((row) => {
    if (Number(row.day) <= 0) return row
    const description = finalizeRegisterScheduleDaySummary(row, { maxDay })
    return description === String(row.description ?? '') ? row : { ...row, description }
  })
}
