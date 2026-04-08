/**
 * 일차 히어로 이미지용 Pexels 검색어 — 장소(stem) + 도시 + 국가를 영문으로 맞추고,
 * 한글·중복·모호한 단어(famous landmark 등)로 검색이 흐려지지 않게 한다.
 */

import { mapDestination } from '@/lib/pexels-keyword'

/** 도시(영문) → 국가/지역(영문). Pexels에서 지명 정밀도 보강용 */
const CITY_TO_COUNTRY_EN: Record<string, string> = {
  tokyo: 'Japan',
  osaka: 'Japan',
  kyoto: 'Japan',
  nara: 'Japan',
  fukuoka: 'Japan',
  sapporo: 'Japan',
  nagoya: 'Japan',
  hiroshima: 'Japan',
  okinawa: 'Japan',
  hakone: 'Japan',
  kanazawa: 'Japan',
  kobe: 'Japan',
  yokohama: 'Japan',
  bangkok: 'Thailand',
  'chiang mai': 'Thailand',
  phuket: 'Thailand',
  pattaya: 'Thailand',
  'da nang': 'Vietnam',
  'hoi an': 'Vietnam',
  hanoi: 'Vietnam',
  'ho chi minh': 'Vietnam',
  'nha trang': 'Vietnam',
  'hong kong': 'Hong Kong',
  macau: 'Macau',
  macao: 'Macau',
  singapore: 'Singapore',
  bali: 'Indonesia',
  jakarta: 'Indonesia',
  seoul: 'South Korea',
  jeju: 'South Korea',
  busan: 'South Korea',
  paris: 'France',
  london: 'UK',
  rome: 'Italy',
  barcelona: 'Spain',
  amsterdam: 'Netherlands',
  dubai: 'UAE',
  istanbul: 'Turkey',
  sydney: 'Australia',
  shanghai: 'China',
  beijing: 'China',
  cebu: 'Philippines',
  manila: 'Philippines',
  boracay: 'Philippines',
  taipei: 'Taiwan',
}

/** 상품 목적지 원문에 국가 한글이 있으면 영어 국가명 */
const KR_SNIPPET_TO_COUNTRY_EN: Array<{ test: (s: string) => boolean; country: string }> = [
  { test: (s) => /일본|도쿄|오사카|교토|후쿠오카|규슈|큐슈|삿포로|나고야|히로시마|오키나와|제주/.test(s), country: 'Japan' },
  { test: (s) => /베트남|다낭|호이안|나트랑/.test(s), country: 'Vietnam' },
  { test: (s) => /태국|방콕|치앙마이|파타야|푸켓/.test(s), country: 'Thailand' },
  { test: (s) => /대만|타이베이|타이페이/.test(s), country: 'Taiwan' },
  { test: (s) => /중국|상하이|베이징/.test(s), country: 'China' },
  { test: (s) => /싱가포르/.test(s), country: 'Singapore' },
  { test: (s) => /홍콩/.test(s), country: 'Hong Kong' },
  { test: (s) => /마카오/.test(s), country: 'Macau' },
  { test: (s) => /발리|인도네시아/.test(s), country: 'Indonesia' },
  { test: (s) => /필리핀|세부|마닐라|보라카이/.test(s), country: 'Philippines' },
  { test: (s) => /괌/.test(s), country: 'Guam' },
  { test: (s) => /사이판/.test(s), country: 'Saipan' },
  { test: (s) => /하와이/.test(s), country: 'Hawaii' },
  { test: (s) => /프랑스|파리/.test(s), country: 'France' },
  { test: (s) => /이탈리아|로마/.test(s), country: 'Italy' },
  { test: (s) => /스페인|바르셀로나/.test(s), country: 'Spain' },
  { test: (s) => /영국|런던/.test(s), country: 'UK' },
  { test: (s) => /두바이/.test(s), country: 'UAE' },
  { test: (s) => /호주|시드니/.test(s), country: 'Australia' },
]

function hangulRatio(s: string): number {
  if (!s) return 0
  const hangul = (s.match(/[\uAC00-\uD7AF]/g) ?? []).length
  return hangul / s.length
}

/** Pexels 쿼리 토큰으로 쓰기 부적절한(한글 위주) 문자열 제외 */
export function isUsableEnglishQueryToken(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (hangulRatio(t) > 0.35) return false
  return true
}

function uniqTokens(parts: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const t = (p ?? '').trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

/**
 * 도시명(영문) + 목적지 원문으로 국가(영문) 추론.
 */
export function inferCountryEnglish(cityEn: string, destinationRaw: string): string | null {
  const cityKey = cityEn.trim().toLowerCase()
  if (cityKey && CITY_TO_COUNTRY_EN[cityKey]) {
    return CITY_TO_COUNTRY_EN[cityKey]
  }
  const raw = destinationRaw ?? ''
  for (const { test, country } of KR_SNIPPET_TO_COUNTRY_EN) {
    if (test(raw)) return country
  }
  return null
}

export type PexelsQuerySet = { primaryQuery: string; secondaryQueries: string[] }

/**
 * 대표 장소 stem + ItineraryDay 도시 + 상품 목적지로 Pexels 검색어 구성.
 * - 국가명을 가능하면 붙여 지명 혼동을 줄임
 * - 목적지에서 나온 한글 덩어리는 쿼리에 넣지 않음(mapDestination이 영문 못 뽑으면 스킵)
 * - `famous landmark` 같은 모호한 보조 검색은 제거
 */
export function buildHeroPexelsQuerySet(opts: {
  stem: string
  city: string | null
  destination: string
}): PexelsQuerySet {
  const base = opts.stem.trim()
  const destRaw = (opts.destination ?? '').trim()
  const cityRaw = (opts.city ?? '').trim()

  const cityMapped = mapDestination(cityRaw || '') || ''
  const destMapped = mapDestination(destRaw) || ''

  const cityEn = isUsableEnglishQueryToken(cityMapped) ? cityMapped : ''
  let destEn = isUsableEnglishQueryToken(destMapped) ? destMapped : ''
  const destWords = destEn.split(/\s+/).filter(Boolean)
  if (destWords.length > 5 || destEn.length > 48) {
    destEn = ''
  }
  if (destEn && cityEn && destEn.toLowerCase() === cityEn.toLowerCase()) {
    destEn = ''
  }
  if (destEn && base.toLowerCase().includes(destEn.toLowerCase())) {
    destEn = ''
  }

  const countryEn = inferCountryEnglish(cityEn || destEn, destRaw)

  const stemWords = base.split(/\s+/).filter(Boolean).length
  /** 짧은 stem은 단독 검색이 오히려 도시 스톡만 끌어올 수 있어, 2단어 이상·길이 있을 때만 단독 시도 */
  const tryStemOnly = stemWords >= 2 || base.length >= 12

  const secondaries: string[] = []
  const pushQ = (q: string) => {
    const t = q.trim()
    if (!t) return
    if (!secondaries.includes(t)) secondaries.push(t)
  }

  /** 1순위: 관광지(영문 stem) + 도시 — 도시만 쓰는 것보다 명소가 앞서게 */
  let primaryQuery = uniqTokens([base, cityEn || undefined]).join(' ').trim()
  if (!primaryQuery) primaryQuery = base
  if (!cityEn && countryEn) {
    primaryQuery = uniqTokens([base, countryEn]).join(' ').trim() || primaryQuery
  }

  /** 2순위 이후: 국가·목적지 변형·stem 단독(구체적일 때) */
  if (cityEn && countryEn) {
    pushQ(uniqTokens([base, cityEn, countryEn]).join(' '))
  }
  if (tryStemOnly) pushQ(base)
  pushQ(uniqTokens([base, countryEn || undefined]).join(' '))
  if (destEn && destEn !== cityEn) {
    pushQ(uniqTokens([base, destEn]).join(' '))
    if (countryEn) pushQ(uniqTokens([base, destEn, countryEn]).join(' '))
  }

  const dedup = secondaries.filter((q) => q !== primaryQuery)

  return {
    primaryQuery,
    secondaryQueries: dedup.slice(0, 8),
  }
}
