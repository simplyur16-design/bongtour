/**
 * 메가메뉴·browse URL의 `country` / `region` / `city` → DB `Product.country`·`Product.continent`·`Product.city`.
 * Prisma 필터·`productMatchesOverseasDestinationTerms`에서 공통 사용.
 */
import { citySlugFromTermsAndLabel, countrySlugFromLabel, koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import { OVERSEAS_LOCATION_TREE_DATA } from '@/lib/overseas-location-tree.data'
import type { OverseasCountryNode, OverseasLeafNode } from '@/lib/overseas-location-tree.types'
import { collectLeafTerms } from '@/lib/unified-location-tree'

/** 운영 `Product.country` (해외 + 국내 지역 라벨) */
const OVERSEAS_AND_DB_COUNTRY_LABELS = new Set<string>([
  '일본',
  '대만',
  '중국',
  '홍콩',
  '마카오',
  '몽골',
  '태국',
  '베트남',
  '필리핀',
  '싱가포르',
  '인도네시아',
  '말레이시아',
  '라오스',
  '스리랑카',
  '인도',
  '미국',
  '캐나다',
  '하와이',
  '호주',
  '괌',
  '사이판',
  '이탈리아',
  '동유럽',
  '북유럽',
  '스페인',
  '포르투갈',
  '튀르키예',
  '그리스',
  '프랑스',
  '스위스',
  '영국',
  '뉴질랜드',
  '몰디브',
  '캄보디아',
  '강원',
  '경상',
  '부산',
  '섬',
  '전라',
  '제주',
  '충북',
])

/** 운영 `Product.city` (해외·국내 허브 한글) — browse `city` 슬러그 매핑 대상 */
const DB_CITY_LABELS = new Set<string>([
  '도쿄',
  '오사카',
  '삿포로',
  '후쿠오카',
  '오키나와',
  '요나고',
  '고베',
  '니세코',
  '타이베이',
  '가오슝',
  '상해',
  '청도',
  '위해',
  '연길',
  '대련',
  '연태',
  '홍콩',
  '마카오',
  '울란바타르',
  '방콕',
  '푸켓',
  '다낭',
  '나트랑',
  '푸꾸옥',
  '싱가포르',
  '발리',
  '마나도',
  '코타키나발루',
  '보홀',
  '클락',
  '비엔티안',
  '콜롬보',
  '델리',
  '로마',
  '취리히',
  '시칠리아',
  '마드리드',
  '프라하',
  '코펜하겐',
  '아테네',
  '이스탄불',
  '런던',
  '파리',
  '루체른',
  '리스본',
  '호놀룰루',
  '로스앤젤레스',
  '밴쿠버',
  '시드니',
  '괌',
  '사이판',
  '강릉',
  '안동',
  '화순',
  '부산',
  '울릉도',
  '제주',
  '제천',
])

/** browse `region` 쿼리 → DB `continent` (없으면 null — me-africa 등) */
const BROWSE_REGION_TO_DB_CONTINENT = new Set([
  'japan',
  'southeast-asia',
  'china-mongolia-ca',
  'hongkong-macau',
  'europe',
  'americas',
  'oceania',
])

/**
 * URL `region`(메가메뉴 탭 id)을 DB `Product.continent` 값으로 정규화.
 * `me-africa` 등 DB에 없는 권역은 null → Prisma에서 continent 조건 생략.
 */
export function normalizeBrowseRegionToDbContinent(region: string | null | undefined): string | null {
  const t = (region ?? '').trim().toLowerCase()
  if (!t) return null
  return BROWSE_REGION_TO_DB_CONTINENT.has(t) ? t : null
}

function uniqueStrings(xs: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of xs) {
    const s = x.trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function inferDbCountriesFromTreeLabel(country: OverseasCountryNode): string[] {
  if (country.dbCountryValues?.length) return uniqueStrings(country.dbCountryValues)
  const L = country.countryLabel.trim()
  if (OVERSEAS_AND_DB_COUNTRY_LABELS.has(L)) return [L]
  const parts = L.split(/[/／·]| · /)
    .map((s) => s.trim())
    .filter(Boolean)
  const hits = uniqueStrings(parts.filter((p) => OVERSEAS_AND_DB_COUNTRY_LABELS.has(p)))
  return hits
}

function buildTreeSlugToDbCountries(): Record<string, string[]> {
  const acc: Record<string, string[]> = {}
  const put = (slug: string, vals: string[]) => {
    const k = slug.trim().toLowerCase()
    const u = uniqueStrings(vals)
    if (!k || u.length === 0) return
    if (!(k in acc)) acc[k] = u
  }
  for (const g of OVERSEAS_LOCATION_TREE_DATA) {
    for (const co of g.countries) {
      const vals = inferDbCountriesFromTreeLabel(co)
      put(countrySlugFromLabel(co.countryLabel), vals)
      put(co.countryKey, vals)
    }
  }
  return acc
}

const TREE_SLUG_TO_DB_COUNTRIES: Record<string, string[]> = buildTreeSlugToDbCountries()

function inferDbCityFromLeaf(leaf: OverseasLeafNode): string | null {
  if (leaf.dbCityValue === null) return null
  if (typeof leaf.dbCityValue === 'string') {
    const t = leaf.dbCityValue.trim()
    if (!t) return null
    return DB_CITY_LABELS.has(t) ? t : null
  }
  const L = leaf.nodeLabel.trim()
  return DB_CITY_LABELS.has(L) ? L : null
}

function buildTreeSlugToDbCity(): Record<string, string> {
  const acc: Record<string, string> = {}
  const put = (slug: string, dbCity: string) => {
    const k = slug.trim().toLowerCase()
    const v = dbCity.trim()
    if (!k || !v) return
    if (!(k in acc)) acc[k] = v
  }
  for (const g of OVERSEAS_LOCATION_TREE_DATA) {
    for (const co of g.countries) {
      for (const leaf of co.children) {
        const terms = collectLeafTerms(co, leaf)
        const slug = citySlugFromTermsAndLabel(leaf.nodeLabel, terms).trim().toLowerCase()
        const db = inferDbCityFromLeaf(leaf)
        if (!db) continue
        put(slug, db)
        const nk = leaf.nodeKey.trim().toLowerCase()
        if (nk && nk !== slug) put(nk, db)
      }
    }
  }
  return acc
}

const TREE_SLUG_TO_DB_CITY: Record<string, string> = buildTreeSlugToDbCity()

/**
 * browse `city` 슬러그 → DB `Product.city` 한글.
 * 트리(`nodeLabel`·`dbCityValue`·`citySlugFromTermsAndLabel`) + 수동 보정.
 */
const BROWSE_CITY_SLUG_TO_DB_CITY: Record<string, string> = {
  ...TREE_SLUG_TO_DB_CITY,
  tokyo: '도쿄',
  osaka: '오사카',
  sapporo: '삿포로',
  fukuoka: '후쿠오카',
  okinawa: '오키나와',
  bangkok: '방콕',
  phuket: '푸켓',
  'da-nang': '다낭',
  danang: '다낭',
  singapore: '싱가포르',
  bali: '발리',
  'hong-kong': '홍콩',
  sydney: '시드니',
  honolulu: '호놀룰루',
}

/**
 * URL `city` 파라미터를 DB `Product.city` 값으로 변환.
 * @returns 매핑 없으면 null — Prisma에서 city 조건 생략.
 */
export function resolveBrowseCityParamToDbCity(param: string | null | undefined): string | null {
  const raw = (param ?? '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  const mapped = BROWSE_CITY_SLUG_TO_DB_CITY[lower]
  if (mapped) return mapped
  if (DB_CITY_LABELS.has(raw)) return raw
  return null
}

/** DB `city`가 browse URL의 city 슬러그와 맞는지 */
export function dbCityMatchesBrowseCityParam(dbCityRaw: string | null | undefined, urlCityParam: string | null | undefined): boolean {
  const url = (urlCityParam ?? '').trim()
  if (!url) return true
  const db = (dbCityRaw ?? '').trim()
  if (!db) return false
  const expected = resolveBrowseCityParamToDbCity(url)
  if (expected) return db === expected
  return db.toLowerCase() === url.toLowerCase()
}

/**
 * browse `country` 슬러그(소문자 키) → DB `country` IN 목록.
 * 트리(`countryKey`·`countryLabel`→슬러그) 매핑 우선, 이후 정적·라벨 폴백.
 */
const BROWSE_COUNTRY_SLUG_TO_DB_COUNTRIES: Record<string, string[]> = {
  ...TREE_SLUG_TO_DB_COUNTRIES,
  'hk-mo-sz': ['홍콩', '마카오'],
  'hong-kong-macau': ['홍콩', '마카오'],
  'shanghai-beijing': ['중국'],
  'qingdao-weihai-yantai': ['중국'],
  'guilin-chenzhou': ['중국'],
  'chengdu-jiuzhaigou': ['중국'],
  hainan: ['중국'],
  'mongolia-inner': ['몽골', '중국'],
  'tokyo-kanto': ['일본'],
  'osaka-kansai': ['일본'],
  'alpine-route': ['일본'],
  'guam-saipan': ['괌', '사이판'],
  'india-nepal-sri-lanka': ['인도', '스리랑카'],
  'sea-multi': ['태국', '베트남', '필리핀', '싱가포르', '인도네시아', '말레이시아', '라오스', '캄보디아'],
  /** 메가메뉴 권역 헤더·슬러그 — 운영 DB `Product.country` 라벨과 정렬 */
  france: ['프랑스'],
  switzerland: ['스위스'],
  italy: ['이탈리아'],
  uk: ['영국'],
  germany: ['동유럽'],
  czech: ['동유럽'],
  austria: ['동유럽'],
  hungary: ['동유럽'],
  spain: ['스페인'],
  portugal: ['포르투갈'],
  greece: ['그리스'],
  turkey: ['튀르키예'],
  morocco: ['스페인'],
  norway: ['북유럽'],
  finland: ['북유럽'],
  denmark: ['북유럽'],
  sweden: ['북유럽'],
  iceland: ['북유럽'],
  netherlands: [],
  belgium: [],
  ireland: [],
  balkans: ['동유럽'],
  'spain-portugal': ['스페인', '포르투갈'],
  'greece-turkey': ['그리스', '튀르키예'],
  'greece-egypt': ['그리스', '튀르키예'],
  'western-europe': ['프랑스', '스위스', '이탈리아', '영국'],
  'eastern-europe': ['동유럽'],
  'southern-europe': ['이탈리아', '스페인', '그리스', '포르투갈'],
  'northern-europe': ['북유럽'],
  서유럽: ['프랑스', '스위스', '이탈리아', '영국'],
  동유럽: ['동유럽'],
  북유럽: ['북유럽'],
  'middle-east': ['튀르키예'],
  caucasus: [],
  'europe-pilgrimage': ['이탈리아', '프랑스', '동유럽', '그리스', '영국'],
  'china-major-cities': ['중국'],
  'china-south-block': ['중국'],
  'china-northeast-block': ['중국'],
  'china-west-block': ['중국'],
  'mongolia-central-asia': ['몽골', '중국'],
  'alaska-caribbean-cruise': ['미국', '캐나다'],
  'africa-browse-countries': [],
  'central-asia': [],
  'china-trekking': ['중국'],
  'south-france': ['프랑스'],
  sicily: ['이탈리아'],
  남프랑스: ['프랑스'],
  시칠리아: ['이탈리아'],
  'usa-south': ['미국'],
  'latin-caribbean': ['미국', '캐나다'],
  'sports-tours': ['일본', '미국'],
  'cruise-east-asia': ['일본', '태국', '싱가포르', '베트남', '필리핀', '말레이시아'],
  thailand: ['태국'],
  vietnam: ['베트남'],
  philippines: ['필리핀'],
  taiwan: ['대만'],
  indonesia: ['인도네시아'],
  malaysia: ['말레이시아'],
  laos: ['라오스'],
  cambodia: [],
  maldives: [],
  'new-zealand': [],
  hawaii: ['하와이'],
  africa: [],
  'latin-america': ['미국', '캐나다'],
  'latin-mexico': ['미국', '캐나다'],
  'us-west': ['미국'],
  'us-east': ['미국'],
  canada: ['캐나다'],
  australia: ['호주'],
  china: ['중국'],
  mongolia: ['몽골'],
  usa: ['미국'],
  'honeymoon-picks': [
    '일본',
    '태국',
    '베트남',
    '필리핀',
    '싱가포르',
    '인도네시아',
    '말레이시아',
    '몰디브',
    '괌',
    '사이판',
    '호주',
    '프랑스',
    '이탈리아',
    '스페인',
    '스위스',
    '하와이',
  ],
  'golf-popular': ['일본', '태국', '베트남', '필리핀', '말레이시아', '괌', '사이판'],
  'sports-theme': ['일본', '미국'],
  'cruise-med-north': ['이탈리아', '북유럽', '그리스', '스페인', '프랑스'],
  'korea-departure': [],
}

/**
 * `resolveBrowseCountryParamToDbCountries`가 `[]`를 반환해도 “슬러그 미정의”가 아닌 경우(의도적 빈 카탈로그 등).
 * 검증 스크립트에서 오탑으로 보지 않는다.
 */
export const BROWSE_COUNTRY_SLUGS_WITH_INTENTIONAL_EMPTY_RESOLVE = new Set<string>([
  'netherlands',
  'belgium',
  'ireland',
  'cambodia',
  'maldives',
  'new-zealand',
  'africa',
  'caucasus',
  'central-asia',
  'africa-browse-countries',
  'korea-departure',
])

/**
 * URL `country` 파라미터를 DB `Product.country` 값 배열로 변환.
 * @returns 매핑 없음·의도적 빈 카탈로그(`[]` 상수)는 빈 배열 — browse API는 이 경우 `country IN ()`로 0건 처리.
 */
export function resolveBrowseCountryParamToDbCountries(param: string | null | undefined): string[] {
  const raw = (param ?? '').trim()
  if (!raw) return []

  const lower = raw.toLowerCase()
  const mapped = BROWSE_COUNTRY_SLUG_TO_DB_COUNTRIES[lower]
  if (mapped !== undefined) {
    return uniqueStrings(mapped)
  }

  const fromSlug = koreanCountryLabelFromBrowseSlug(lower)
  if (fromSlug) {
    if (OVERSEAS_AND_DB_COUNTRY_LABELS.has(fromSlug)) return [fromSlug]
    const parts = fromSlug
      .split(/[/／,，、·]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const hits = uniqueStrings(parts.filter((p) => OVERSEAS_AND_DB_COUNTRY_LABELS.has(p)))
    if (hits.length > 0) return hits
  }

  if (OVERSEAS_AND_DB_COUNTRY_LABELS.has(raw)) return [raw]

  return []
}

/** DB에 저장된 `country`가 browse URL의 country 슬러그와 맞는지 */
export function dbCountryMatchesBrowseCountryParam(dbCountryRaw: string | null | undefined, urlCountryParam: string | null | undefined): boolean {
  const url = (urlCountryParam ?? '').trim()
  if (!url) return true
  const db = (dbCountryRaw ?? '').trim()
  if (!db) return false
  const accepted = resolveBrowseCountryParamToDbCountries(url)
  if (accepted.length === 0) {
    return db.toLowerCase() === url.toLowerCase()
  }
  return accepted.includes(db)
}
