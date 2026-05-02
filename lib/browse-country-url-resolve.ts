/**
 * 메가메뉴·browse URL의 `country` 쿼리(영문 슬러그 등) → DB `Product.country` 한글 값.
 * Prisma 필터·`productMatchesOverseasDestinationTerms`에서 공통 사용.
 */
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'

/** 운영에서 쓰는 `Product.country` 값(국내 지역 + 해외). 슬러그·라벨 매칭 기준. */
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

/**
 * browse `country` 슬러그(소문자 키) → DB `country` IN 목록.
 * 복합 메뉴·중국 권역·일본 권역 등은 명시 매핑이 우선.
 */
const BROWSE_COUNTRY_SLUG_TO_DB_COUNTRIES: Record<string, string[]> = {
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
  'western-europe': ['이탈리아', '스페인', '프랑스', '스위스', '포르투갈', '영국', '그리스', '튀르키예'],
  'eastern-europe': ['동유럽'],
  'southern-europe': ['이탈리아', '스페인', '그리스', '포르투갈'],
  'northern-europe': ['북유럽'],
  'middle-east': ['튀르키예'],
  africa: [],
  'latin-america': ['미국', '캐나다'],
  'latin-mexico': ['미국', '캐나다'],
  'us-west': ['미국'],
  'us-east': ['미국'],
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

function uniqueStrings(xs: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of xs) {
    const t = x.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/**
 * URL `country` 파라미터를 DB `Product.country` 값 배열로 변환.
 * @returns 비어 있으면 DB 국가 조건을 건너뛴다(권역·도시·terms만 적용).
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
