/**
 * 지방출발 감지 — 명시 신호만(원 공급사 제목·rawTitle·출발공항 필드). 추측 금지.
 * REGRESSION-FREEZE[local-departure-detect-explicit]: 명시 신호·X항공 제외·힐 머리말 무시·복수 도시·미등록 도시 review — manifest
 *
 * - 결과는 `Product.localDepartureTag` 후보로만 쓴다. `Product.title` 은 절대 쓰지 않는다.
 * - 제목 신호: `부산출발`·`부산 출발`·`부산항출발`·`부산/대구출발`·`#부산항출발`. `제주항공`·`사천항공` 등 항공사명은 출발 신호 아님.
 * - 힐이 붙였던 맨 앞 `[X출발] ` 머리말(rawTitle·title)은 무시 — 자기 강화 오탐 방지.
 * - 내일투어 `[대구]` 처럼 괄호 안이 도시명뿐인 공급사 관례는 `bareCityBracketIsDeparture` 일 때만 인정.
 * - 목록에 있지만 태그 값이 없는 도시(무안·광주 등) → review `city-known-no-tag`.
 *   목록에 없는 `X출발` → review `city-unlisted`. 둘 다 태그로 쓰지 않는다.
 */
import { LOCAL_DEPARTURE_TAG_VALUES, type LocalDepartureTag } from '@/lib/product-listing-kind'

export type KrDepartureCity = {
  key: string
  /** 제목 표기 (긴 것 우선 매칭) */
  names: readonly string[]
  iata: readonly string[]
  /** `Product.localDepartureTag` 값 — 없으면 review 대상 */
  tag: LocalDepartureTag | null
}

/** 한국 지방 공항·항만 (인천·김포·서울 제외) */
export const KR_LOCAL_DEPARTURE_CITIES: readonly KrDepartureCity[] = [
  { key: 'busan', names: ['부산', '김해'], iata: ['PUS'], tag: 'busan' },
  { key: 'daegu', names: ['대구'], iata: ['TAE'], tag: 'daegu' },
  { key: 'cheongju', names: ['청주'], iata: ['CJJ'], tag: 'cheongju' },
  { key: 'jeju', names: ['제주'], iata: ['CJU'], tag: 'jeju' },
  { key: 'muan', names: ['무안'], iata: ['MWX'], tag: null },
  { key: 'gwangju', names: ['광주'], iata: ['KWJ'], tag: null },
  { key: 'yangyang', names: ['양양'], iata: ['YNY'], tag: null },
  { key: 'yeosu', names: ['여수'], iata: ['RSU'], tag: null },
  { key: 'ulsan', names: ['울산'], iata: ['USN'], tag: null },
  { key: 'pohang', names: ['포항'], iata: ['KPO'], tag: null },
  { key: 'wonju', names: ['원주'], iata: ['WJU'], tag: null },
  { key: 'gunsan', names: ['군산'], iata: ['KUV'], tag: null },
  { key: 'sacheon', names: ['사천', '진주'], iata: ['HIN'], tag: null },
]

/** 수도권 출발 — 지방출발 아님 */
const SEOUL_HUB_NAMES = ['인천', '김포', '서울', '수도권']
const SEOUL_HUB_IATA = ['ICN', 'GMP', 'SEL']

/** `X출발` 앞 단어 중 도시가 아닌 것 (미등록 도시 review 오탐 방지) */
const NON_CITY_WORDS = new Set([
  '매일', '확정', '단독', '평일', '주말', '전일', '당일', '정기', '특별', '직항', '오전', '오후', '새벽', '야간',
  '국내', '지방', '연휴', '추석', '설날', '매주', '해외', '현지', '전국', '동시', '선착순', '조기', '특가', '한정',
  '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일', '항공', '공항', '국제', '출발', '미정',
  '아침', '저녁', '무조건', '좌석확보', '100%', '항시',
])

/** `부산오전출발` 처럼 도시와 출발 사이 시간대 표기 */
const TIME_OF_DAY = '(?:오전|오후|아침|저녁|새벽|야간|밤|낮)'

export type LocalDepartureSignalSource = 'originalTitle' | 'rawTitle' | 'departureAirport'

export type LocalDepartureSignal = { source: LocalDepartureSignalSource; city: string; text: string }

export type LocalDepartureReview = {
  reason: 'city-known-no-tag' | 'city-unlisted'
  city: string
  source: LocalDepartureSignalSource
  text: string
}

export type LocalDepartureDetectInput = {
  originalTitle?: string | null
  rawTitle?: string | null
  /** 출발 회차 `outboundDepartureAirport` 들 (null 허용) */
  departureAirports?: ReadonlyArray<string | null | undefined> | null
  /** 내일투어 `[대구]` 관례 — 괄호 안 도시명만 있으면 출발로 인정 */
  bareCityBracketIsDeparture?: boolean
}

export type LocalDepartureDetection = {
  /** 감지된 지방 도시 key (태그 유무 무관, 정렬) */
  cities: string[]
  /** `localDepartureTag` 후보 (정규 순서) */
  tags: LocalDepartureTag[]
  signals: LocalDepartureSignal[]
  review: LocalDepartureReview[]
}

const CITY_BY_NAME = new Map<string, KrDepartureCity>()
const CITY_BY_IATA = new Map<string, KrDepartureCity>()
for (const c of KR_LOCAL_DEPARTURE_CITIES) {
  for (const n of c.names) CITY_BY_NAME.set(n, c)
  for (const i of c.iata) CITY_BY_IATA.set(i, c)
}
const NAME_ALT = [...CITY_BY_NAME.keys(), ...SEOUL_HUB_NAMES].sort((a, b) => b.length - a.length).join('|')

/** `부산출발`·`부산 출발`·`부산항출발`·`김해공항 출발`·`부산/대구출발` */
const LISTED_DEPARTURE_RE = new RegExp(
  `(?<![가-힣])((?:${NAME_ALT})(?:\\s*(?:국제)?\\s*(?:공항|항))?(?:\\s*[\\/·,&+]\\s*(?:${NAME_ALT})(?:\\s*(?:국제)?\\s*(?:공항|항))?)*)(?:\\s*${TIME_OF_DAY})?\\s*출발`,
  'g',
)
/** 임의 `X출발` — 미등록 도시 review 용 (괄호·구분자·# 뒤 또는 문두) */
const ANY_DEPARTURE_RE = /(?:^|[\[\(\s\/+·,#|])([가-힣]{2,4}?)\s*(?:국제)?\s*(?:공항|항)?\s*출발/g
const NAME_TOKEN_RE = new RegExp(`(${NAME_ALT})`, 'g')

/** 힐이 붙인 맨 앞 `[부산출발] ` 1개 제거 (힐은 머리말을 한 번만 붙였음 — 그 뒤 원래 괄호는 유지) */
export function stripHealAddedDeparturePrefix(title: string): string {
  return String(title ?? '').replace(/^\s*\[(?:부산|대구|청주|제주)출발\] /, '')
}

function citiesInTitle(
  text: string,
  source: LocalDepartureSignalSource,
  bareBracket: boolean,
  out: { signals: LocalDepartureSignal[]; review: LocalDepartureReview[] },
): void {
  if (!text.trim()) return
  const covered: Array<[number, number]> = []
  for (const m of text.matchAll(LISTED_DEPARTURE_RE)) {
    const start = m.index ?? 0
    covered.push([start, start + m[0].length])
    for (const t of m[1]!.matchAll(NAME_TOKEN_RE)) {
      const city = CITY_BY_NAME.get(t[1]!)
      if (city) out.signals.push({ source, city: city.key, text: m[0] })
    }
  }
  if (bareBracket) {
    for (const m of text.matchAll(/\[\s*([가-힣]{2,3})\s*\]/g)) {
      const city = CITY_BY_NAME.get(m[1]!)
      if (city) out.signals.push({ source, city: city.key, text: m[0] })
    }
  }
  for (const m of text.matchAll(ANY_DEPARTURE_RE)) {
    const word = m[1]!
    const at = (m.index ?? 0) + m[0].indexOf(word)
    if (covered.some(([a, b]) => at >= a && at < b)) continue
    if (CITY_BY_NAME.has(word) || SEOUL_HUB_NAMES.includes(word) || NON_CITY_WORDS.has(word)) continue
    if (/^[월화수목금토일]$/.test(word)) continue
    out.review.push({ reason: 'city-unlisted', city: word, source, text: m[0].trim() })
  }
}

function cityFromAirportField(v: string): KrDepartureCity | null | 'seoul' {
  const s = v.trim()
  if (!s) return null
  const up = s.toUpperCase()
  for (const code of SEOUL_HUB_IATA) if (new RegExp(`\\b${code}\\b`).test(up)) return 'seoul'
  if (SEOUL_HUB_NAMES.some((n) => s.includes(n))) return 'seoul'
  for (const [code, c] of CITY_BY_IATA) if (new RegExp(`\\b${code}\\b`).test(up)) return c
  for (const m of s.matchAll(NAME_TOKEN_RE)) {
    const c = CITY_BY_NAME.get(m[1]!)
    if (c) return c
  }
  return null
}

export function detectLocalDepartureFromExplicitSignals(input: LocalDepartureDetectInput): LocalDepartureDetection {
  const acc = { signals: [] as LocalDepartureSignal[], review: [] as LocalDepartureReview[] }
  const bare = Boolean(input.bareCityBracketIsDeparture)
  citiesInTitle(String(input.originalTitle ?? ''), 'originalTitle', bare, acc)
  citiesInTitle(stripHealAddedDeparturePrefix(String(input.rawTitle ?? '')), 'rawTitle', bare, acc)
  const seenAirport = new Set<string>()
  for (const a of input.departureAirports ?? []) {
    const v = typeof a === 'string' ? a.trim() : ''
    if (!v || seenAirport.has(v)) continue
    seenAirport.add(v)
    const c = cityFromAirportField(v)
    if (c && c !== 'seoul') acc.signals.push({ source: 'departureAirport', city: c.key, text: v })
  }
  const order = new Map(KR_LOCAL_DEPARTURE_CITIES.map((c, i) => [c.key, i]))
  const cities = [...new Set(acc.signals.map((s) => s.city))].sort((a, b) => order.get(a)! - order.get(b)!)
  const tagSet = new Set<string>()
  const review: LocalDepartureReview[] = []
  const reviewKey = new Set<string>()
  for (const key of cities) {
    const c = KR_LOCAL_DEPARTURE_CITIES.find((x) => x.key === key)!
    if (c.tag) tagSet.add(c.tag)
    else {
      const sig = acc.signals.find((s) => s.city === key)!
      review.push({ reason: 'city-known-no-tag', city: key, source: sig.source, text: sig.text })
    }
  }
  for (const r of acc.review) {
    const k = `${r.reason}:${r.city}`
    if (reviewKey.has(k)) continue
    reviewKey.add(k)
    review.push(r)
  }
  return {
    cities,
    tags: LOCAL_DEPARTURE_TAG_VALUES.filter((t) => tagSet.has(t)),
    signals: acc.signals,
    review,
  }
}
