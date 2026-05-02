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
  '네덜란드',
  '벨기에',
  '아일랜드',
  '이집트',
  '모로코',
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

/** browse `region` 쿼리 → DB `continent` (단일 매칭; 병합 탭은 `browseRegionToDbContinents` 사용) */
const BROWSE_REGION_TO_DB_CONTINENT = new Set([
  'japan',
  'southeast-asia',
  'china-mongolia-ca',
  'hongkong-macau',
  'europe',
  'me-africa',
  'americas',
  'oceania',
])

/**
 * URL `region`(메가메뉴 탭 id)을 DB `Product.continent` 값으로 정규화.
 * 병합 탭(`europe-me`, `china-hk-mo`)은 null — Prisma·매칭은 `browseRegionToDbContinents`로 처리.
 */
export function normalizeBrowseRegionToDbContinent(region: string | null | undefined): string | null {
  const t = (region ?? '').trim().toLowerCase()
  if (!t) return null
  return BROWSE_REGION_TO_DB_CONTINENT.has(t) ? t : null
}

/**
 * 메가메뉴 탭 id → DB `Product.continent` 값 1개 이상 (Prisma `OR`·매칭용).
 * 빈 배열이면 continent 조건 없음.
 */
export function browseRegionToDbContinents(region: string | null | undefined): string[] {
  const t = (region ?? '').trim().toLowerCase()
  if (!t) return []
  if (t === 'europe-me') return ['europe', 'me-africa']
  if (t === 'china-hk-mo') return ['china-mongolia-ca', 'hongkong-macau']
  const one = normalizeBrowseRegionToDbContinent(t)
  return one ? [one] : []
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
 * 중국 탭 메가메뉴 행(`mega-menu-geography` browseCountryLabelForUrl = 행 라벨) → DB country·Prisma 서브필터 키워드.
 * `china-major` 등 트리 단일 노드 전체는 키워드 없음(별도 슬러그로 null 처리).
 */
const CHINA_MEGA_BROWSE_ROWS: { label: string; countries: string[]; keywords: string[] }[] = [
  {
    label: '청도',
    countries: ['중국'],
    keywords: ['청도', '칭다오', 'qingdao'],
  },
  {
    label: '위해',
    countries: ['중국'],
    keywords: ['위해', 'weihai', '웨이하이'],
  },
  {
    label: '연태',
    countries: ['중국'],
    keywords: ['연태', 'yantai', '옌타이'],
  },
  {
    label: '상해',
    countries: ['중국'],
    keywords: ['상해', '상하이', 'shanghai'],
  },
  {
    label: '소주',
    countries: ['중국'],
    keywords: ['소주', 'suzhou', '苏州', '주가각', 'zhujiajiao', '무석', 'wuxi'],
  },
  {
    label: '북경',
    countries: ['중국'],
    keywords: ['북경', '베이징', 'beijing'],
  },
  {
    label: '천진',
    countries: ['중국'],
    keywords: ['천진', '톈진', 'tianjin'],
  },
  {
    label: '청도 · 위해 · 연태',
    countries: ['중국'],
    keywords: [
      '청도',
      '위해',
      '연태',
      '칭다오',
      'qingdao',
      '웨이하이',
      'weihai',
      '옌타이',
      'yantai',
      '제난',
      'jinan',
      '산동',
      'shandong',
    ],
  },
  {
    label: '대련',
    countries: ['중국'],
    keywords: ['대련', 'dalian'],
  },
  {
    label: '장가계',
    countries: ['중국'],
    keywords: ['장가계', 'zhangjiajie'],
  },
  {
    label: '장사',
    countries: ['중국'],
    keywords: ['장사', 'changsha', '长沙', '장가계', 'zhangjiajie'],
  },
  {
    label: '무한',
    countries: ['중국'],
    keywords: ['무한', 'wuhan', '은시', 'yichang', '무당산'],
  },
  {
    label: '계림',
    countries: ['중국'],
    keywords: ['계림', 'guilin', '양삭'],
  },
  {
    label: '광저우',
    countries: ['중국'],
    keywords: ['광저우', '광주', 'guangzhou', '广州'],
  },
  {
    label: '연길',
    countries: ['중국'],
    keywords: ['연길', 'yanji', 'yanbian', '백두산', 'changbai', '장백산', '심양', 'shenyang', '장춘', 'changchun'],
  },
  {
    label: '연길 · 심양 · 장춘 · 백두산',
    countries: ['중국'],
    keywords: ['연길', '심양', '장춘', '백두산', 'changbai'],
  },
  {
    label: '하얼빈',
    countries: ['중국'],
    keywords: ['하얼빈', 'harbin'],
  },
  {
    label: '성도 · 구채구',
    countries: ['중국'],
    keywords: [
      '성도',
      'chengdu',
      '구채구',
      'jiuzhaigou',
      '사천',
      'sichuan',
      '티벳',
      'tibet',
      '충칭',
      'chongqing',
      '중경',
    ],
  },
  {
    label: '서안 · 우루무치',
    countries: ['중국'],
    keywords: ['서안', '우루무치', 'urumqi', "xi'an", 'xian'],
  },
  {
    label: '곤명 · 여강',
    countries: ['중국'],
    keywords: ['곤명', 'kunming', '여강', 'lijiang', '리장'],
  },
  {
    label: '귀주 · 안순',
    countries: ['중국'],
    keywords: ['귀양', 'guiyang', '안순', 'anshun', '귀주'],
  },
  {
    label: '하이난',
    countries: ['중국'],
    keywords: ['하이난', 'hainan', '삼야', 'sanya', '하이커우', 'haikou'],
  },
  {
    label: '항주',
    countries: ['중국'],
    keywords: ['항주', 'hangzhou', '杭州'],
  },
  {
    label: '내몽골',
    countries: ['중국'],
    keywords: [
      '후룬베이얼',
      'hulunbuir',
      '오르도스',
      'ordos',
      '적봉',
      '치펑',
      'chifeng',
      '내몽골',
      '내몽고',
    ],
  },
  { label: '중국 트레킹', countries: ['중국'], keywords: [] },
]

const CHINA_TAB_SLUG_TO_DB_COUNTRIES: Record<string, string[]> = {}
const CHINA_SUBREGION_SLUG_TO_CITY_KEYWORDS_CN: Record<string, string[]> = {}
for (const row of CHINA_MEGA_BROWSE_ROWS) {
  const k = countrySlugFromLabel(row.label).toLowerCase()
  CHINA_TAB_SLUG_TO_DB_COUNTRIES[k] = uniqueStrings(row.countries)
  if (row.keywords.length > 0) {
    CHINA_SUBREGION_SLUG_TO_CITY_KEYWORDS_CN[k] = uniqueStrings(row.keywords)
  }
}
const shandongSlug = countrySlugFromLabel('청도 · 위해 · 연태').toLowerCase()
const shandongKw = CHINA_SUBREGION_SLUG_TO_CITY_KEYWORDS_CN[shandongSlug]
if (shandongKw?.length) {
  CHINA_SUBREGION_SLUG_TO_CITY_KEYWORDS_CN['qingdao-weihai-yantai'] = [...shandongKw]
}

/**
 * browse `country` 슬러그(소문자 키) → DB `country` IN 목록.
 * 트리(`countryKey`·`countryLabel`→슬러그) 매핑 우선, 이후 정적·라벨 폴백.
 */
const BROWSE_COUNTRY_SLUG_TO_DB_COUNTRIES: Record<string, string[]> = {
  ...TREE_SLUG_TO_DB_COUNTRIES,
  ...CHINA_TAB_SLUG_TO_DB_COUNTRIES,
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
  니세코: ['일본'],
  센다이: ['일본'],
  벳부: ['일본'],
  유후인: ['일본'],
  가고시마: ['일본'],
  나가사키: ['일본'],
  나하: ['일본'],
  후라노: ['일본'],
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
  poland: ['동유럽'],
  warsaw: ['동유럽'],
  바르샤바: ['동유럽'],
  spain: ['스페인'],
  portugal: ['포르투갈'],
  greece: ['그리스'],
  turkey: ['튀르키예'],
  egypt: ['이집트'],
  morocco: ['스페인', '포르투갈', '모로코'],
  norway: ['북유럽'],
  finland: ['북유럽'],
  denmark: ['북유럽'],
  sweden: ['북유럽'],
  iceland: ['북유럽'],
  netherlands: ['네덜란드'],
  belgium: ['벨기에', '네덜란드'],
  ireland: ['영국', '아일랜드'],
  balkans: ['동유럽'],
  'spain-portugal': ['스페인', '포르투갈'],
  'greece-turkey': ['그리스', '튀르키예'],
  /** 레거시 URL (구 그리스·이집트 결합 슬러그) */
  'greece-egypt': ['그리스', '이집트'],
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

/** 일본 권역(메가메뉴 `country` 슬러그) → DB `city`·목적지 부분문자열 매칭용 키워드 */
const JP_KANTO = uniqueStrings([
  '도쿄',
  '요코하마',
  '치바',
  '사이타마',
  '가나가와',
])
const JP_KANSAI = uniqueStrings(['오사카', '고베', '교토', '나라', '와카야마'])
const JP_KYUSHU = uniqueStrings([
  '후쿠오카',
  '나가사키',
  '구마모토',
  '가고시마',
  '오이타',
  '미야자키',
  '벳부',
  '유후인',
])
const JP_HOKKAIDO = uniqueStrings([
  '삿포로',
  '니세코',
  '오타루',
  '후라노',
  '비에이',
  '하코다테',
  '아사히카와',
])
const JP_OKINAWA = uniqueStrings(['오키나와', '나하'])
const JP_SHIKOKU_CHUGOKU = uniqueStrings([
  '요나고',
  '돗토리',
  '히로시마',
  '마츠에',
  '구라요시',
  '마츠야마',
  '다카마츠',
  '다카마쓰',
])
const JP_TOHOKU = uniqueStrings(['센다이', '아오모리', '아키타'])
const JP_CHUBU = uniqueStrings(['나고야', '가나자와', '다카야마'])

function buildJapanSubregionSlugToCityKeywords(): Record<string, string[]> {
  const pairs: [readonly string[], string[]][] = [
    [
      [
        '간토-관동',
        'jp-kanto',
        'tokyo-kanto',
        'kanto',
        '간토',
        '관동',
      ],
      JP_KANTO,
    ],
    [
      ['간사이-관서', 'jp-kansai', 'osaka-kansai', 'kansai', '간사이', '관서'],
      JP_KANSAI,
    ],
    [['규슈', 'jp-kyushu', 'kyushu', '큐슈'], JP_KYUSHU],
    [['홋카이도', 'jp-hokkaido', 'hokkaido', '북해도'], JP_HOKKAIDO],
    [['오키나와', 'jp-okinawa', 'okinawa'], JP_OKINAWA],
    [
      ['시코쿠-주고쿠', '주고쿠-시코쿠', 'jp-shikoku-chugoku', '시코쿠', '주고쿠'],
      JP_SHIKOKU_CHUGOKU,
    ],
    [
      [
        '중부-호쿠리쿠-알펜루트',
        'jp-chubu-hokuriku',
        'alpine-route',
        '추부',
        '호쿠리쿠',
        '중부',
      ],
      JP_CHUBU,
    ],
    [['도호쿠-동북', 'jp-tohoku', 'tohoku', '도호쿠', '동북'], JP_TOHOKU],
  ]
  const acc: Record<string, string[]> = {}
  for (const [slugs, cities] of pairs) {
    for (const s of slugs) {
      const k = s.trim().toLowerCase()
      if (!k) continue
      acc[k] = cities
    }
  }
  return acc
}

const JAPAN_SUBREGION_SLUG_TO_CITY_KEYWORDS: Record<string, string[]> =
  buildJapanSubregionSlugToCityKeywords()

/**
 * browse URL `country`가 일본 하위 권역(간사이·간토 등)이면 DB `city`·목적지 검색용 키워드.
 * `japan`·`일본`(전체)·선박 연계 등은 null.
 */
export function resolveJapanSubregionDbCityKeywords(
  countryParam: string | null | undefined
): string[] | null {
  const raw = (countryParam ?? '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower === 'japan' || lower === '일본' || lower === '일본-선박-연계' || lower === 'jp-ferry') {
    return null
  }
  const hit = JAPAN_SUBREGION_SLUG_TO_CITY_KEYWORDS[lower]
  if (!hit?.length) return null
  return uniqueStrings(hit)
}

/**
 * browse URL `country`가 중국 탭 메가메뉴 하위 행(산동·상해·동북 등)이면 DB `city`·목적지 검색용 키워드.
 * 몽골·중앙아·`china-major` 전체·`중국` 단독 등은 null.
 */
export function resolveChinaSubregionDbCityKeywords(
  countryParam: string | null | undefined
): string[] | null {
  const raw = (countryParam ?? '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (
    lower === 'china' ||
    lower === '중국' ||
    lower === 'china-major' ||
    lower === '중국-주요-도시' ||
    lower === '중국-주요도시' ||
    lower === 'mongolia' ||
    lower === '몽골' ||
    lower === 'central-asia' ||
    lower === '중앙아시아' ||
    lower === 'china-trekking' ||
    lower === '중국-트레킹'
  ) {
    return null
  }
  const hit = CHINA_SUBREGION_SLUG_TO_CITY_KEYWORDS_CN[lower]
  if (!hit?.length) return null
  return uniqueStrings(hit)
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
