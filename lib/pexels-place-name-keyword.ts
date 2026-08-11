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
  'monument valley': 'Monument Valley',
  'monument valley utah': 'Monument Valley',
  'monument valley arizona': 'Monument Valley',
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
  'beijing forbidden city view': 'Beijing',
  'forbidden city': 'Forbidden City',
  'summer palace': 'Summer Palace',
  'tiananmen square': 'Tiananmen Square',
  'great wall of china': 'Great Wall of China',
  '798 art district': '798 Art District',
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
  'dome',
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
  'frankfurt',
  'dresden',
  'nuremberg',
  'kempten',
  'bamberg',
  'potsdam',
  'fussen',
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
  'beach',
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
  'valley',
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
    'phu quoc',
    'bangkok',
    'chiang mai',
    'phuket',
    'pattaya',
    'singapore',
    'bali',
    'jakarta',
    'cebu',
    'bohol',
    'madrid',
    'toledo',
    'segovia',
    'thessaloniki',
    'athens',
    'miyazaki',
    'kagoshima',
    'saga',
    'karatsu',
    'manila',
    'boracay',
    'nuremberg',
    'amman',
    'taipei',
    'sapa',
    'new york',
    'kota kinabalu',
    'hong kong',
    'macau',
    'macao',
    'shanghai',
    'beijing',
    'zhangjiajie',
    'changsha',
    'guangzhou',
    'shenzhen',
    'taipei',
    'paris',
    'london',
    'rome',
    'barcelona',
    'amsterdam',
    'dubai',
    'nairobi',
    'cape town',
    'arusha',
    'istanbul',
    'sydney',
    'seoul',
    'busan',
    'jeju',
    'guam',
    'saipan',
    'hawaii',
    'maldives',
    'seattle',
    'juneau',
    'prague',
    'vienna',
    'budapest',
    'athens',
    'santorini',
    'jozankei',
    'otaru',
    'tashkent',
    'samarkand',
    'almaty',
    'bishkek',
    'oslo',
    'bergen',
    'copenhagen',
    'stockholm',
    'helsinki',
    'vilnius',
    'tallinn',
    'aarhus',
    'odense',
    'kota kinabalu',
    'manado',
    'delhi',
    'new delhi',
    'jaipur',
    'agra',
    'cairo',
    'luxor',
    'aswan',
    'giza',
    'hurghada',
    'new york',
    'washington dc',
    'washington',
    'philadelphia',
    'boston',
    'chicago',
    'los angeles',
    'san francisco',
    'toronto',
    'montreal',
    'vancouver',
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
    'auckland',
    'rotorua',
    'queenstown',
    'christchurch',
    'melbourne',
    'gold coast',
    'cairns',
    'perth',
    'brisbane',
    'uluru',
    'new zealand',
    'australia',
    'marrakech',
    'rio de janeiro',
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
  'bondi beach': 'Bondi Beach',
  'starfish beach': 'Starfish Beach',
  'sao beach': 'Sao Beach',
  'sunset town': 'Sunset Town',
  'kiss bridge': 'Kiss Bridge',
  'sunset sanato beach': 'Sunset Sanato Beach',
  'grand world': 'Grand World',
  'ho quoc pagoda': 'Ho Quoc Pagoda',
  'coconut tree prison': 'Coconut Tree Prison',
  'sonasea night market': 'Sonasea Night Market',
  'new york': 'New York',
  'hong kong': 'Hong Kong',
  'los angeles': 'Los Angeles',
  'san francisco': 'San Francisco',
  'las vegas': 'Las Vegas',
  'forbidden city': 'Forbidden City',
  'summer palace': 'Summer Palace',
  'tiananmen square': 'Tiananmen Square',
  'great wall of china': 'Great Wall of China',
  'great wall': 'Great Wall of China',
  '798 art district': '798 Art District',
  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: ATP223 Dihua Street≠bare Dihua — manifest
  'dihua street': 'Dihua Street',
  'dihua street taipei': 'Dihua Street Taipei',
  'dadaocheng pier 5': 'Dadaocheng Pier 5',
  'dadaocheng pier 5 taipei': 'Dadaocheng Pier 5 Taipei',
  /** REGRESSION-FREEZE[schedule-segment-poi-oceania-japan-europe]: NZ·AU 복합 명소 — geo strip 보호 — manifest */
  'lake rotorua': 'Lake Rotorua',
  'agrodome rotorua': 'Agrodome Rotorua',
  'skyline rotorua gondola': 'Skyline Rotorua gondola',
  'polynesian spa rotorua': 'Polynesian Spa Rotorua',
  'whakarewarewa maori village': 'Whakarewarewa Maori Village',
  'kumeu wine region auckland': 'Kumeu Valley wineries',
  'kumeu valley wineries': 'Kumeu Valley wineries',
  'mission bay auckland': 'Mission Bay Auckland',
  'michael joseph savage memorial auckland': 'Michael Joseph Savage Memorial',
  'auckland domain wintergardens': 'Auckland Domain',
  'queenstown lake wakatipu': 'Queenstown Lake Wakatipu',
  'lake tekapo church of good shepherd': 'Lake Tekapo',
  'milford sound new zealand': 'Milford Sound',
  'mount cook new zealand': 'Mount Cook',
  'waitomo glowworm caves': 'Waitomo Glowworm Caves',
  'great barrier reef cairns': 'Great Barrier Reef',
  'auckland sky tower': 'Auckland Sky Tower',
  'surfers paradise gold coast': 'Surfers Paradise',
  'te anau glowworm caves new zealand': 'Te Anau glowworm caves',
  'petra treasury jordan': 'Petra Treasury',
  'swiss alps matterhorn': 'Swiss Alps Matterhorn',
  'marrakech jemaa el-fnaa': 'Marrakech Jemaa el-Fnaa',
  'rio de janeiro christ the redeemer': 'Christ the Redeemer Rio de Janeiro',
  'sagrada familia barcelona': 'Sagrada Familia Barcelona',
  'colosseum rome': 'Colosseum Rome',
  'mount fuji japan': 'Mount Fuji Japan',
  'kawarau gorge suspension bridge': 'Kawarau Gorge Suspension Bridge',
  'arrowtown historic street': 'Arrowtown historic street',
  'queenstown gardens': 'Queenstown Gardens',
  'mirror lakes milford sound': 'Mirror Lakes Milford Sound',
  'homer tunnel': 'Homer Tunnel',
  'church of good shepherd lake tekapo': 'Church of Good Shepherd Lake Tekapo',
  'lake pukaki mount cook view': 'Lake Pukaki Mount Cook view',
  'hagley park christchurch': 'Hagley Park Christchurch',
  'avon river christchurch': 'Avon River Christchurch',
  'mona vale garden christchurch': 'Mona Vale Garden Christchurch',
  'christchurch tram city': 'Christchurch Tram city',
  'hamilton gardens': 'Hamilton Gardens',
  'hamurana springs': 'Hamurana Springs',
  'lake taupo': 'Lake Taupo',
  'huka falls': 'Huka Falls',
  'wai-o-tapu geothermal rotorua': 'Wai-O-Tapu geothermal Rotorua',
  'redwoods whakarewarewa forest': 'Redwoods Whakarewarewa Forest',
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
    // REGRESSION-FREEZE[pexels-normalize-bare-multiword-city]: Phu Quoc 등 CITY_COUNTRY_ONLY 전체명 보존 — manifest
    'phu quoc',
    'los angeles',
    'san francisco',
    'las vegas',
    'lake ashi',
    'ba na hills',
    'lake rotorua',
    'milford sound',
    'halong bay',
    'phi phi islands',
  ]
  const fullLower = words.join(' ').toLowerCase()
  // 키워드 전체가 bare 도시·국가면 제거하지 않음 (Phu Quoc → '' 회귀 방지)
  if (CITY_COUNTRY_ONLY.has(fullLower) || multiGeo.includes(fullLower)) {
    return titleCaseWords(fullLower)
  }
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
  const out = squash(trimmed.join(' '))
  // 전부 깎여 빈 문자열이 되면 원문 유지 (2단어 CITY_COUNTRY_ONLY 보호망)
  if (!out && CITY_COUNTRY_ONLY.has(fullLower)) return titleCaseWords(fullLower)
  return out
}

/**
 * 어떤 imageKeyword든 정규화하여 장소 고유명만 반환. 의미 없으면 빈 문자열.
 */
// REGRESSION-FREEZE[pexels-normalize-monument-valley]: Monument Valley — do not strip Valley — manifest
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

/** 스파·라운지·마트·쇼핑 — Pexels 일정 imageKeyword(랜드마크 전용)에 부적합 */
const NON_LANDMARK_SPA_SHOPPING_LOUNGE_RE =
  /\b(spa|massage|wellness\s*center|lounge|club\s*lounge|t\s*lounge|bar\s*&\s*lounge|duty\s*free|shopping\s*mall|supermarket|minimart|convenience\s*store|grocery|retail\s*mall|outlet\s*mall|designer\s*outlet|department\s*store|resort\s*restaurant|moon\s*spa|king\s*kong\s*mart|sound\s*of\s*music)\b/i

export function isNonLandmarkSpaShoppingLoungeImageKeyword(keyword: string): boolean {
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  if (/스파|라운지|마트|면세|쇼핑몰|킹콩|뷔페|힐링\s*스파/u.test(raw)) return true
  const n = normalizeToPlaceName(raw).toLowerCase()
  if (!n) return false
  return NON_LANDMARK_SPA_SHOPPING_LOUNGE_RE.test(n)
}

/** 항공사·캐리어 브랜드 — Pexels 일정 imageKeyword(랜드마크 전용)에 부적합 */
const AIRLINE_CARRIER_RE =
  /\b(?:airlines?|airways|air\s*line|항공(?:사)?)\b|air\s*premia|singapore\s+airlines|korean\s+air|asiana\s+air|jeju\s+air|t\s*way|eastar\s+jet|air\s+canada|westjet|vietjet|vietnam\s+airlines|eva\s+air|china\s+airlines|china\s+eastern|china\s+southern|united\s+airlines|delta\s+air|american\s+airlines|british\s+airways|lufthansa|emirates|qatar\s+airways|turkish\s+airlines|air\s+france|klm|jal|ana\b|peach\s+aviation|spring\s+airlines|hainan\s+airlines|malaysia\s+airlines|garuda\s+indonesia|philippine\s+airlines|scoot\b|jetstar|airasia|finnair|sas\b|swiss\s+air|iberia|alitalia|ryanair|easyjet|zipair|air\s+seoul|air\s+busan/i

export function isAirlineCarrierImageKeyword(keyword: string): boolean {
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  if (/항공(?:사)?|에어라인|직항\s*노선/u.test(raw)) return true
  if (/에어\s*프(?:레미아|리미아)|에어프(?:레미아|리미아)/u.test(raw)) return true
  if (/^에어[\uAC00-\uD7AF]{1,12}(?:\s*항공)?$/u.test(raw)) return true
  const n = normalizeToPlaceName(raw).toLowerCase()
  if (!n) return false
  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: UAE EMP340 Day2 — Emirates Palace·왕궁·모스크·분수·에티하드 — manifest
  // Emirates Palace(아부다비 랜드마크) ≠ Emirates 항공사
  if (/\bemirates\s+palace\b/i.test(n)) return false
  if (/\betihad\s+towers?\b/i.test(n)) return false
  return AIRLINE_CARRIER_RE.test(n)
}

/** 역사 수용·억압 시설 — Pexels 관광 이미지 검색에 부적합 */
const NON_LANDMARK_HISTORICAL_PRISON_RE = /\b(prison|concentration\s+camp|detention\s+camp)\b/i

export function isNonLandmarkHistoricalPrisonImageKeyword(keyword: string): boolean {
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  if (/수용소|억류소|구치소/u.test(raw)) return true
  const n = normalizeToPlaceName(raw).toLowerCase()
  if (!n) return false
  return NON_LANDMARK_HISTORICAL_PRISON_RE.test(n)
}

/** 호텔·숙박 시설명 — Pexels 관광지 키워드로 부적합 */
export function isHotelLodgingImageKeyword(keyword: string): boolean {
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  if (/호텔|숙박|리조트|펜션|모텔|게스트하우스|체크인|관광\s*캠프|투어(?:리스트|ist)\s*캠프|포포인츠|포\s*포인트|판보르네오|Pan\s*Borneo/u.test(raw)) {
    return true
  }
  const n = normalizeToPlaceName(raw).toLowerCase()
  if (!n) return false
  /** 괌 PIC(Pacific Island Club) 등 리조트 브랜드 — Pexels 관광지명이 아님 */
  if (n === 'pic' || /\bpic\s*resort\b/i.test(n)) return true
  return /\b(hotel|resort|hostel|inn|lodging|suites|mercure|marriott|hilton|hyatt|sheraton|intercontinental|novotel|ibis|radisson|sofitel|fairmont|pan\s*pacific|mandarin\s*oriental|shangri-la|ritz|four\s*seasons|four\s*points|crowne\s*plaza|holiday\s*inn|best\s*western|motel|tourist\s*camp|tour\s*camp|mirage\s*tourist)\b/i.test(
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
  if (isNonLandmarkSpaShoppingLoungeImageKeyword(n)) return false
  if (isNonLandmarkHistoricalPrisonImageKeyword(n)) return false
  if (n.split(/\s+/).length >= 2) return true
  return LANDMARK_HINT_RE.test(n)
}

/** 짧은 불투명 단어(Khem 등) — 랜드마크·도시명이 아니면 부적합 */
export function isWeakOpaqueImageKeyword(keyword: string): boolean {
  const n = normalizeToPlaceName(keyword)
  if (!n) return true
  const words = n.split(/\s+/).filter(Boolean)
  if (words.length !== 1) return false
  if (words[0]!.length > 5) return false
  if (LANDMARK_HINT_RE.test(n)) return false
  if (isBareCityOrCountryKeyword(n)) return false
  return true
}

function isNonLandmarkRouteTextSegmentKo(t: string): boolean {
  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: UAE EMP340 Day2 — Emirates Palace·왕궁·모스크·분수·에티하드 — manifest
  // 「에미레이트 팰리스호텔 … +아부다비 왕궁」처럼 호텔 토큰과 관광 POI가 한 세그먼트면 통째로 버리지 않음
  if (
    /(?:왕궁|팰리스|모스크|분수|사원|궁전|타워|전망대|크루즈|시장|수크|프레임|칼리파|에미레이트|에티하드|아부다비)/u.test(
      t,
    )
  ) {
    return false
  }
  return /스파|라운지|마트|면세|쇼핑|식당|레스토랑|뷔페|호텔|리조트|공항|픽업|이동|체크인|숙박|식사|조식|중식|석식|킹콩|T\s*라운지|문\s*스파|국제\s*공항|투숙|안내사항|유의사항|입국신고|입국\s*도시|선택관광|서커스|팁$|자금성\s*안내|관광\s*캠프|투어(?:리스트|ist)\s*캠프|미라지\s*캠프|유목민\s*게르|현대식\s*게르|아울렛|아웃렛|OUTLET|Sound\s*of\s*Music|사운드\s*오브\s*뮤직|VIP\s*리무진|리무진\s*버스|인력거|릭샤|리크샤|rickshaw|도시락|이른\s*기상|소림(?:무술)?쇼|경극|전문대가/u.test(
    t,
  ) || /(?:^|\s)캠프(?:\s|$)/u.test(t)
}

/** routeText 세그먼트 — 스파·라운지·마트·공항 등 랜드마크 후보 제외 */
export function isNonLandmarkRouteTextSegment(seg: string): boolean {
  const t = String(seg ?? '').trim()
  if (!t) return true
  if (isNonLandmarkRouteTextSegmentKo(t)) return true
  if (/\b(?:mirage\s*)?tourist\s*camp\b/i.test(t)) return true
  const en = normalizeToPlaceName(t).toLowerCase()
  if (!en) return false
  return (
    isNonLandmarkFoodOrDiningImageKeyword(en) ||
    isNonLandmarkSpaShoppingLoungeImageKeyword(en) ||
    isNonLandmarkHistoricalPrisonImageKeyword(en) ||
    isHotelLodgingImageKeyword(en) ||
    /\b(airport|international\s*airport|pickup|transfer)\b/i.test(en) ||
    /^(?:boarding|departure|arrival|airport)\s+gates?$/i.test(en) ||
    /^gates?$/i.test(en)
  )
}

/** Pexels 일정 imageKeyword — 관광 랜드마크만 허용 */
export function isScheduleImageKeywordLandmarkEligible(keyword: string): boolean {
  const n = normalizeToPlaceName(keyword)
  if (!n || n.length < 3) return false
  if (isAirlineCarrierImageKeyword(n)) return false
  if (isNonLandmarkFoodOrDiningImageKeyword(n)) return false
  if (isNonLandmarkSpaShoppingLoungeImageKeyword(n)) return false
  if (isNonLandmarkHistoricalPrisonImageKeyword(n)) return false
  if (isHotelLodgingImageKeyword(n)) return false
  if (isWeakOpaqueImageKeyword(n)) return false
  return isLikelyTourismLandmarkKeyword(n)
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
