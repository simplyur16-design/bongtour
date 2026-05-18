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
  'universal studios japan osaka': 'Universal Studios Japan',
  'tokyo disneyland castle': 'Tokyo Disneyland',
  'fushimi inari shrine / thousand vermilion torii gates / eye-level front view': 'Fushimi Inari',
  'kinkakuji golden pavilion kyoto': 'Kinkaku-ji',
  'ginkakuji temple kyoto': 'Ginkaku-ji',
  'osaka dotonbori night': 'Dotonbori',
  'beijing forbidden city view': 'Forbidden City',
  'barcelona sagrada familia exterior': 'Sagrada Familia',
  'rome colosseum view': 'Colosseum',
  'paris city skyline': 'Paris',
  'london thames skyline': 'London',
  'new york manhattan skyline': 'New York',
  'nagoya castle view': 'Nagoya Castle',
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
  'studios',
  'studio',
  'disneyland',
  'disney',
  'universal',
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
const CITY_COUNTRY_ONLY = new Set(
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
  let words = squash(s).split(' ').filter(Boolean)
  if (words.length <= 1) return squash(s)

  const lower = words.map((w) => w.toLowerCase())
  const protectedIdx = lower.findIndex((w) => PROTECTED_TRAILING.has(w))
  const minKeep = protectedIdx >= 0 ? protectedIdx + 1 : 1

  let changed = true
  while (changed && words.length > minKeep) {
    changed = false
    const last = words[words.length - 1]!.toLowerCase()
    if (PROTECTED_TRAILING.has(last)) break
    if (TRAILING_MODIFIER_WORDS.includes(last)) {
      words = words.slice(0, -1)
      changed = true
    }
  }

  return squash(words.join(' '))
}

/** 끝에 붙은 도시·국가 보조어 제거 (New York·Hong Kong 등 복합 지명은 유지) */
function stripTrailingGeoTokens(s: string): string {
  const words = squash(s).split(' ').filter(Boolean)
  if (words.length <= 1) return squash(s)

  const multiGeo = ['new york', 'hong kong', 'ho chi minh', 'da nang', 'hoi an', 'chiang mai', 'los angeles', 'san francisco', 'las vegas', 'lake ashi', 'ba na hills', 'halong bay', 'phi phi islands']
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
  if (fromLlm) return fromLlm

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
    if (n) return n
  }

  const city = normalizeToPlaceName(input.cityEn ?? '')
  if (city && CITY_COUNTRY_ONLY.has(city.toLowerCase())) return city

  const country = normalizeToPlaceName(input.countryEn ?? '')
  if (country && CITY_COUNTRY_ONLY.has(country.toLowerCase())) return country

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
