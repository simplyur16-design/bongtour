/**
 * Pexels 검색용 일정 imageKeyword SSOT — 영문 관광지/랜드마크 고유명 1개만.
 * Gemini 이미지 생성 프롬프트와 분리한다.
 */

import { detectBannedSuffix } from '@/lib/image-keyword-verify-guards'
import { extractPrimaryEnglishPlaceName } from '@/lib/english-schedule-place-extract'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'

const DAY_TRAVEL_RE = /^day\s*\d+\s*travel$/i
const MEANINGLESS_RE =
  /^(?:travel|tour|city\s*tour|scenic\s+stop|international\s+flight|real\s+place\s+name)(?:\s|$)/i

/** 레거시·후처리 오염 → 표준 고유명 */
const CANONICAL_BY_LOWER: Record<string, string> = {
  'shibuya crossing tokyo night': 'Shibuya Crossing',
  'shibuya crossing tokyo': 'Shibuya Crossing',
  'dotonbori osaka night': 'Dotonbori',
  'shanghai bund skyline': 'The Bund',
  'shanghai bund': 'The Bund',
  'the bund shanghai': 'The Bund',
  'halong bay aerial view': 'Halong Bay',
  'eiffel tower paris': 'Eiffel Tower',
  'taipei 101 tower night': 'Taipei 101',
  'jiufen old street taiwan night': 'Jiufen',
  'universal studios singapore': 'Universal Studios Singapore',
  'universal studios japan osaka': 'Universal Studios Japan',
  'universal studios japan': 'Universal Studios Japan',
  'universal studios': 'Universal Studios',
  'warner bros movie world': 'Warner Bros Movie World',
  'tokyo disneyland castle': 'Tokyo Disneyland',
  'tokyo disneyland': 'Tokyo Disneyland',
  'hong kong disneyland': 'Hong Kong Disneyland',
  'shanghai disneyland': 'Shanghai Disneyland',
  'legoland malaysia': 'Legoland Malaysia',
  'gardaland': 'Gardaland',
  'ocean park hong kong': 'Ocean Park Hong Kong',
  'henderson waves bridge': 'Henderson Waves Bridge',
  'marina bay sands': 'Marina Bay Sands',
  'gardens by the bay': 'Gardens by the Bay',
  'merlion park': 'Merlion Park',
  'sentosa island': 'Sentosa',
  'fushimi inari shrine / thousand vermilion torii gates / eye-level front view': 'Fushimi Inari',
  'kinkakuji golden pavilion kyoto': 'Kinkaku-ji',
  'ginkakuji temple kyoto': 'Ginkaku-ji',
  'osaka dotonbori night': 'Dotonbori',
  'beijing forbidden city view': 'Forbidden City',
  'shanghai skyline night': 'The Bund',
  'shanghai skyline': 'The Bund',
  'yu garden shanghai': 'Yu Garden',
  'west lake hangzhou': 'West Lake',
  'songcheng park': 'Songcheng Park',
  'city god temple of shanghai': 'City God Temple of Shanghai',
  'barcelona sagrada familia exterior': 'Sagrada Familia',
  'rome colosseum view': 'Colosseum',
  'paris city skyline': 'Paris',
  'london thames skyline': 'London',
  'new york manhattan skyline': 'New York',
  'nagoya castle view': 'Nagoya Castle',
  'nha trang': 'Nha Trang',
}

/** 삼단·Pexels 보조 segment (첫 segment 이후 또는 단독 제거) */
const TRIPARTITE_TAIL_RE =
  /\s*\/\s*(?:landmark\s+)?(?:exterior|interior|facade|architecture|ornate|religious|shrine|natural\s+scenery|wide\s+view|street-level\s+view|eye-level(?:\s+view)?|front\s+view|frontal\s+view|close\s+view|aerial\s+view)(?:\s*\/\s*[^/]+)?$/i

/** 끝에서 제거할 보조어(고유명 일부는 화이트리스트) */
const TRAILING_MODIFIER_WORDS = [
  'photorealistic',
  'photograph',
  'landscape',
  'landmark',
  'exterior',
  'interior',
  'facade',
  'architecture',
  'view',
  'views',
  'street-level',
  'street',
  'level',
  'aerial',
  'skyline',
  'night',
  'daytime',
  'day',
  'sunrise',
  'sunset',
  'dusk',
  'wide',
  'angle',
  'eye-level',
  'frontal',
  'front',
  'close',
  'scenic',
  'canal',
  'bridge',
  'waterfront',
  'water',
  'town',
  'district',
  'area',
  'region',
  'city',
  'downtown',
  'metropolitan',
  'island',
  'islands',
  'beach',
  'bay',
  'river',
  'valley',
  'mountain',
  'mountains',
  'gorge',
  'snow',
  'abbey',
  'gates',
  'thousand',
  'vermilion',
  'torii',
  'pavilion',
  'tower',
  'castle',
  'temple',
  'shrine',
  'museum',
  'park',
  'garden',
  'palace',
  'square',
  'market',
  'resort',
  'hotel',
  'terminal',
  'airport',
  'international',
  'flight',
  'window',
  'crossing',
  'nightlife',
  'neon',
  'lantern-lit',
  'old',
  'ancient',
  'historic',
  'heritage',
  'cultural',
  'theme',
  'japan',
  'tokyo',
  'osaka',
  'kyoto',
  'paris',
  'london',
  'rome',
  'barcelona',
  'shanghai',
  'beijing',
  'guangzhou',
  'shenzhen',
  'bangkok',
  'vietnam',
  'thailand',
  'taiwan',
  'china',
  'france',
  'italy',
  'spain',
  'uk',
  'manhattan',
  'harbour',
  'harbor',
  'thames',
  'forbidden',
  'familia',
  'sagrada',
  'colosseum',
  'nagoya',
  'sapporo',
  'fukuoka',
  'yokohama',
  'nara',
  'hiroshima',
  'okinawa',
  'hakone',
  'kanazawa',
  'kobe',
  'da',
  'nang',
  'hoi',
  'an',
  'chiang',
  'mai',
  'phuket',
  'pattaya',
  'hanoi',
  'chi',
  'minh',
  'nha',
  'trang',
  'bali',
  'jakarta',
  'cebu',
  'manila',
  'boracay',
  'macau',
  'macao',
  'singapore',
  'sydney',
  'dubai',
  'istanbul',
  'amsterdam',
  'interlaken',
  'zurich',
  'bern',
  'geneva',
  'milan',
  'venice',
  'florence',
  'munich',
  'berlin',
  'prague',
  'vienna',
  'budapest',
  'athens',
  'cairo',
  'marrakech',
  'seoul',
  'busan',
  'jeju',
  'guam',
  'saipan',
  'hawaii',
  'honolulu',
  'waikiki',
  'los',
  'angeles',
  'san',
  'francisco',
  'las',
  'vegas',
  'new',
  'york',
  'hong',
  'kong',
]

/** 고유명 끝에 유지할 토큰(보조어 제거 스킵) */
const PROTECTED_TRAILING = new Set([
  'crossing',
  'bay',
  'bridge',
  'tower',
  'castle',
  'palace',
  'temple',
  'shrine',
  'museum',
  'island',
  'islands',
  'peak',
  'falls',
  'wall',
  'gate',
  'square',
  'market',
  'garden',
  'park',
  'fjord',
  'lagoon',
  'reef',
  'volcano',
  'mountain',
  'mountains',
])

/** 도시·국가명 단독(관광지 고유명이 아닌 경우만 폴백 허용) */
export const CITY_COUNTRY_ONLY = new Set(
  [
    'tokyo',
    'osaka',
    'kyoto',
    'nara',
    'fukuoka',
    'sapporo',
    'nagoya',
    'hiroshima',
    'okinawa',
    'hakone',
    'kanazawa',
    'kobe',
    'yokohama',
    'da nang',
    'hoi an',
    'hanoi',
    'ho chi minh',
    'nha trang',
    'bangkok',
    'chiang mai',
    'phuket',
    'pattaya',
    'singapore',
    'bali',
    'jakarta',
    'cebu',
    'manila',
    'boracay',
    'hong kong',
    'macau',
    'macao',
    'shanghai',
    'beijing',
    'guangzhou',
    'shenzhen',
    'taipei',
    'paris',
    'london',
    'rome',
    'barcelona',
    'amsterdam',
    'dubai',
    'istanbul',
    'sydney',
    'seoul',
    'busan',
    'jeju',
    'guam',
    'saipan',
    'hawaii',
    'new york',
    'japan',
    'vietnam',
    'thailand',
    'china',
    'taiwan',
    'france',
    'italy',
    'spain',
    'uk',
    'europe',
    'asia',
    'usa',
    'united states',
    'korea',
    'south korea',
  ].map((s) => s.toLowerCase()),
)

function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function canonicalLookup(s: string): string | null {
  const key = squash(s).toLowerCase()
  return CANONICAL_BY_LOWER[key] ?? null
}

function titleCaseWords(s: string): string {
  const small = new Set(['of', 'the', 'and', 'de', 'la', 'le', 'du', 'van', 'von', 'in', 'at', 'on'])
  return squash(s)
    .split(' ')
    .map((w, i) => {
      const lower = w.toLowerCase()
      if (i > 0 && small.has(lower)) return lower
      if (/^[A-Z]{2,}$/.test(w)) return w
      if (lower === 'jiu' && s.toLowerCase().includes('jiufen')) return 'Jiufen'
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
    .replace(/\bJiufen\b/, 'Jiufen')
    .replace(/\bUsj\b/, 'USJ')
    .replace(/\bApec\b/, 'APEC')
}

function isMeaninglessKeyword(s: string): boolean {
  const t = squash(s)
  if (!t || t.length < 2) return true
  if (DAY_TRAVEL_RE.test(t)) return true
  if (MEANINGLESS_RE.test(t)) return true
  if (/^scenic\s+stop\b/i.test(t)) return true
  if (/^international\s+flight\b/i.test(t)) return true
  if (/travel\s+route\s+context/i.test(t)) return true
  return false
}

/** stripTrailingModifiers 전에 보존 — 복합 관광지 고유명 */
const COMPOUND_LANDMARK_PHRASES: Record<string, string> = {
  'universal studios japan': 'Universal Studios Japan',
  'universal studios': 'Universal Studios',
  'warner bros movie world': 'Warner Bros Movie World',
  'tokyo disneyland': 'Tokyo Disneyland',
  'hong kong disneyland': 'Hong Kong Disneyland',
  'shanghai disneyland': 'Shanghai Disneyland',
  'legoland malaysia': 'Legoland Malaysia',
  'ocean park hong kong': 'Ocean Park Hong Kong',
  'harbour city hong kong': 'Harbour City Hong Kong',
  'harbour city': 'Harbour City Hong Kong',
  'soho hong kong': 'SoHo Hong Kong',
  'tai kwun': 'Tai Kwun',
  'wong tai sin temple': 'Wong Tai Sin Temple',
  'avenue of stars hong kong': 'Avenue of Stars Hong Kong',
  '1881 heritage hong kong': '1881 Heritage Hong Kong',
  'star ferry hong kong': 'Star Ferry Hong Kong',
  'henderson waves bridge': 'Henderson Waves Bridge',
  'marina bay sands': 'Marina Bay Sands',
  'gardens by the bay': 'Gardens by the Bay',
  'merlion park': 'Merlion Park',
  'sentosa island': 'Sentosa',
  'phi phi islands': 'Phi Phi Islands',
  'ha long bay': 'Halong Bay',
  'lake ashi': 'Lake Ashi',
  'ba na hills': 'Ba Na Hills',
  'ho chi minh city': 'Ho Chi Minh City',
  'chiang mai': 'Chiang Mai',
  'nha trang': 'Nha Trang',
  'new york': 'New York',
  'hong kong': 'Hong Kong',
  'los angeles': 'Los Angeles',
  'san francisco': 'San Francisco',
  'las vegas': 'Las Vegas',
}

function resolveCompoundLandmarkPhrase(s: string): string | null {
  const key = squash(s).toLowerCase()
  if (!key) return null
  return COMPOUND_LANDMARK_PHRASES[key] ?? CANONICAL_BY_LOWER[key] ?? null
}

function stripTripartiteSegments(s: string): string {
  let t = squash(s)
  if (!t) return ''
  if (t.includes('/')) {
    t = squash(t.split('/')[0] ?? '')
  }
  t = t.replace(TRIPARTITE_TAIL_RE, '').trim()
  return t
}

function stripTrailingModifiers(s: string): string {
  const compound = resolveCompoundLandmarkPhrase(s)
  if (compound) return compound

  let words = squash(s).split(' ').filter(Boolean)
  if (words.length <= 1) return squash(s)

  const lower = words.map((w) => w.toLowerCase())
  const protectedIdx = lower.findIndex((w) => PROTECTED_TRAILING.has(w))
  const minKeep = protectedIdx >= 0 ? protectedIdx + 1 : 1

  let changed = true
  while (changed && words.length > minKeep) {
    changed = false
    const candidate = squash(words.join(' '))
    const compoundMid = resolveCompoundLandmarkPhrase(candidate)
    if (compoundMid) return compoundMid
    const last = words[words.length - 1]!.toLowerCase()
    if (PROTECTED_TRAILING.has(last)) break
    if (TRAILING_MODIFIER_WORDS.includes(last)) {
      words = words.slice(0, -1)
      changed = true
    }
  }

  const out = squash(words.join(' '))
  return resolveCompoundLandmarkPhrase(out) ?? out
}

/** 끝에 붙은 도시·국가 보조어 제거 (New York·Hong Kong 등 복합 지명은 유지) */
function stripTrailingGeoTokens(s: string): string {
  const words = squash(s).split(' ').filter(Boolean)
  if (words.length <= 1) return squash(s)

  const multiGeo = [
    'new york',
    'hong kong',
    'ho chi minh',
    'ho chi minh city',
    'da nang',
    'hoi an',
    'chiang mai',
    'nha trang',
    'los angeles',
    'san francisco',
    'las vegas',
    'lake ashi',
    'ba na hills',
    'halong bay',
    'phi phi islands',
  ]
  const fullLower = words.join(' ').toLowerCase()
  for (const mg of multiGeo) {
    if (fullLower === mg || fullLower.endsWith(` ${mg}`)) {
      if (fullLower === mg) return titleCaseWords(mg)
      const prefix = fullLower.slice(0, fullLower.length - mg.length).trim()
      if (prefix.split(' ').length >= 1) return titleCaseWords(prefix)
    }
  }

  let trimmed = [...words]
  while (trimmed.length > 1) {
    const tail = trimmed.slice(-2).join(' ').toLowerCase()
    const tail1 = trimmed[trimmed.length - 1]!.toLowerCase()
    if (multiGeo.includes(tail)) break
    if (CITY_COUNTRY_ONLY.has(tail) || CITY_COUNTRY_ONLY.has(tail1)) {
      trimmed = trimmed.slice(0, CITY_COUNTRY_ONLY.has(tail) ? -2 : -1)
      continue
    }
    break
  }
  return squash(trimmed.join(' '))
}

/**
 * 어떤 imageKeyword든 정규화하여 장소 고유명만 반환. 의미 없으면 빈 문자열.
 */
export function normalizeToPlaceName(rawKeyword: string): string {
  let t = squash(String(rawKeyword ?? ''))
  if (!t) return ''

  const compoundEarly = resolveCompoundLandmarkPhrase(t)
  if (compoundEarly) return compoundEarly

  const canonFull = canonicalLookup(t)
  if (canonFull) return canonFull

  t = stripTripartiteSegments(t)
  if (!t) return ''

  const canonSeg = canonicalLookup(t)
  if (canonSeg) return canonSeg

  t = stripTrailingModifiers(t)
  t = stripTrailingGeoTokens(t)
  t = titleCaseWords(t)

  const canonFinal = canonicalLookup(t)
  if (canonFinal) return canonFinal

  if (isMeaninglessKeyword(t)) return ''
  if (/[가-힣]/.test(t)) return ''
  if (!/[A-Za-z]{2,}/.test(t)) return ''

  return t.slice(0, 90)
}

/** 식당·카페·음식점 — Pexels 일정 imageKeyword(랜드마크 전용)에 부적합 */
const NON_LANDMARK_FOOD_VENUE_RE =
  /\b(cafe|café|coffee\s*shop|restaurant|dining|bistro|bakery|eatery|ramen|noodle\s*shop|food\s*stall|street\s*food|hawker|brunch\s*spot|gastropub|food\s*court|kitchen|culinary|dim\s*sum|sushi\s*bar|bbq\s*restaurant|steakhouse|pizzeria|trattoria|brasserie|tea\s*house|bubble\s*tea|dessert\s*shop|ice\s*cream\s*parlor|barbecue\s*restaurant|tapas\s*bar|izakaya|yakiniku|pho\s*shop|burger\s*joint|food\s*hall|dining\s*hall)\b/i

const NON_LANDMARK_FOOD_PHRASE_RE =
  /\b(laneway\s*cafes?|cafe\s*lane|ramen\s*street|food\s*street|night\s*market\s*food|local\s*food|food\s*tour|culinary\s*tour|restaurant\s*row|dining\s*district)\b/i

export function isNonLandmarkFoodOrDiningImageKeyword(keyword: string): boolean {
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  if (/카페|식당|레스토랑|맛집|음식점|다이닝|조식|중식|석식|뷔페|라멘|이자카야/u.test(raw)) return true
  const n = normalizeToPlaceName(raw).toLowerCase()
  if (!n) return false
  return NON_LANDMARK_FOOD_VENUE_RE.test(n) || NON_LANDMARK_FOOD_PHRASE_RE.test(n)
}

/** 호텔·숙박 시설명 — Pexels 관광지 키워드로 부적합 */
export function isHotelLodgingImageKeyword(keyword: string): boolean {
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  if (/호텔|숙박|리조트|펜션|모텔|게스트하우스|체크인/u.test(raw)) return true
  const n = normalizeToPlaceName(raw).toLowerCase()
  if (!n) return false
  /** 괌 PIC(Pacific Island Club) 등 리조트 브랜드 — Pexels 관광지명이 아님 */
  if (n === 'pic' || /\bpic\s*resort\b/i.test(n)) return true
  return /\b(hotel|resort|hostel|inn|lodging|suites|mercure|marriott|hilton|hyatt|sheraton|intercontinental|novotel|ibis|radisson|sofitel|fairmont|pan\s*pacific|mandarin\s*oriental|shangri-la|ritz|four\s*seasons|crowne\s*plaza|holiday\s*inn|best\s*western|motel)\b/i.test(
    n,
  )
}

/** 단순 도시·국가명만인 키워드(관광 일차 Pexels 1·2순위에 쓰이면 안 됨) */
export function isBareCityOrCountryKeyword(keyword: string): boolean {
  const n = normalizeToPlaceName(keyword)
  if (!n) return false
  return CITY_COUNTRY_ONLY.has(n.toLowerCase())
}

const LANDMARK_HINT_RE =
  /\b(garden|temple|shrine|palace|castle|museum|pagoda|stupa|mosque|cathedral|fort|square|market|bund|lake|tower|peak|disney|studios|old\s+town|ancient|waterfall|fjord|beach|quarter|village|terrace|bridge|harbour|harbor|island|abbey|colosseum|sagrada|acropolis|yu\s+garden|west\s+lake|oriental\s+pearl|merlion|sentosa|marina)\b/i

/** 2단어 이상 또는 랜드마크 성격 단어가 포함된 고유명 */
export function isLikelyTourismLandmarkKeyword(keyword: string): boolean {
  const n = normalizeToPlaceName(keyword)
  if (!n || isBareCityOrCountryKeyword(n) || isHotelLodgingImageKeyword(n)) return false
  if (isNonLandmarkFoodOrDiningImageKeyword(n)) return false
  if (n.split(/\s+/).length >= 2) return true
  return LANDMARK_HINT_RE.test(n)
}

export type ExtractPlaceNameKeywordInput = {
  llmImageKeyword?: string
  title?: string
  description?: string
  rawBody?: string
  cityEn?: string
  countryEn?: string
}

/**
 * 일정 1일치 Pexels용 영문 관광지 고유명.
 */
export function extractPlaceNameKeyword(input: ExtractPlaceNameKeywordInput): string {
  const fromLlm = normalizeToPlaceName(input.llmImageKeyword ?? '')
  const fromLlmOk = fromLlm && !isBareCityOrCountryKeyword(fromLlm) && isLikelyTourismLandmarkKeyword(fromLlm)
  if (fromLlmOk) return fromLlm

  const hay = [input.rawBody, input.description, input.title].filter(Boolean).join('\n')
  const mappedKo = mapKoreanPoiSegment(hay)
  if (mappedKo) {
    const n = normalizeToPlaceName(mappedKo)
    if (n) return n
  }

  const place = extractPrimaryEnglishPlaceName(
    input.rawBody ?? '',
    input.description ?? '',
    input.title ?? '',
  )
  if (place) {
    const n = normalizeToPlaceName(place)
    if (n && !isBareCityOrCountryKeyword(n)) return n
  }

  if (fromLlm && !isBareCityOrCountryKeyword(fromLlm)) return fromLlm

  return ''
}

/**
 * 저장 직전 가드. 보조어 패턴 감지 시 즉시 throw.
 * fail-fast — 가드 위반은 SSOT 또는 normalize 누락 신호.
 */
export function assertCleanPlaceKeyword(keyword: string): string {
  const trimmed = keyword.trim()
  if (!trimmed) return ''

  const banned = detectBannedSuffix(trimmed)
  if (banned !== null) {
    throw new Error(
      `[PEXELS_KEYWORD_VIOLATION] 보조어 패턴 감지: "${trimmed}" ` +
        `(패턴: "${banned}"). normalizeToPlaceName()을 먼저 거쳐야 합니다.`,
    )
  }
  return trimmed
}

/** 등록·추출 파이프라인 공통 — 정규화 후 가드. `Day N travel` 등은 빈 문자열. */
export function finalizeScheduleImageKeyword(raw: string): string {
  const normalized = normalizeToPlaceName(raw)
  return assertCleanPlaceKeyword(normalized)
}
