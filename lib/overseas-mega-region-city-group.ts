import type { OverseasGeoFilterBanner } from '@/lib/overseas-destination-browse'
import {
  detectCaucasusPackageFromHaystack,
  detectCaucasusPackageFromKeys,
} from '@/lib/caucasus-package-detect'
import { SINGLE_CHAR_GEO_TERMS, termAppearsInHaystack } from '@/lib/geo-haystack-match'
import { resolveBrowseCityKeysForFilter } from '@/lib/browse-country-url-resolve'
import { CLUSTER_CITY_EXPANSIONS } from '@/lib/cluster-city-expansions'
import { findMegaMenuGroup } from '@/lib/mega-menu-browse-group'
import { megaMenuPlacementForCityKey } from '@/lib/mega-menu-city-group-coherence'
import { matchMegaMenuCityKeysInHaystack } from '@/lib/mega-menu-master-city-keys'
import { citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import {
  MEGA_MENU_TAB_DEFINITIONS,
  type MegaMenuCountryGroupDef,
  type MegaMenuLeafDef,
  type MegaMenuTabDef,
} from '@/lib/mega-menu-regions.data'
import {
  buildOverseasProductMatchHaystack,
  type MatchProductToOverseasNodeResult,
  type OverseasProductMatchInput,
} from '@/lib/match-overseas-product'
import { searchParamsRecordToUrlSearchParams } from '@/lib/products-browse-hub-query'
import { parseBrowseQuery } from '@/lib/products-browse-query'

/** 메가메뉴 대분류 탭 — 하위 지역(그룹)별 목록 그룹 대상 */
export const MEGA_MENU_REGION_CITY_GROUP_TAB_IDS = [
  'europe-me',
  'southeast-asia',
  'japan',
  'china-hk-mo',
  'oceania',
  'americas',
  'south-america',
] as const

export type MegaMenuRegionCityGroupTabId = (typeof MEGA_MENU_REGION_CITY_GROUP_TAB_IDS)[number]

const MEGA_MENU_REGION_CITY_GROUP_TAB_SET = new Set<string>(MEGA_MENU_REGION_CITY_GROUP_TAB_IDS)

export function isMegaMenuRegionCityGroupTabId(region: string | null | undefined): region is MegaMenuRegionCityGroupTabId {
  return MEGA_MENU_REGION_CITY_GROUP_TAB_SET.has((region ?? '').trim())
}

/** browse 섹션 표시 순서 — 메가메뉴 정의와 다른 탭만 오버라이드 */
const SUBGROUP_DISPLAY_ORDER_OVERRIDE: Partial<Record<string, string[]>> = {
  'southeast-asia': [
    '베트남',
    '태국',
    '싱가포르',
    '인도네시아',
    '필리핀',
    '대만',
    '인도',
    '스리랑카',
    '네팔',
    '몰디브',
    '말레이시아',
    '캄보디아',
    '라오스',
    '미얀마',
  ],
  americas: ['하와이', '미서부', '미동부', '캐나다', '알래스카'],
  'south-america': ['멕시코', '쿠바', '페루', '브라질', '아르헨티나', '칠레', '볼리비아', '도미니카'],
  'china-hk-mo': ['중국', '홍콩/마카오', '몽골'],
  japan: ['홋카이도', '간사이', '도호쿠', '간토', '주고쿠-시코쿠', '규슈', '추부', '오키나와'],
  oceania: ['괌', '사이판', '호주', '뉴질랜드'],
  'europe-me': [
    '서유럽',
    '동유럽',
    '코카서스 3국',
    '북유럽',
    '튀르키예',
    '이집트',
    '중동',
    '아프리카',
    '스페인/포르투갈',
    '그리스',
  ],
}

/** 메가메뉴 countryGroup → browse 섹션 라벨 (중국 본토·홍콩/마카오 병합) */
export function megaMenuGroupToDisplayLabel(regionId: string, groupCountryLabel: string): string {
  const label = groupCountryLabel.trim()
  if (regionId === 'china-hk-mo') {
    if (label === '홍콩' || label === '마카오') return '홍콩/마카오'
    if (label === '몽골') return '몽골'
    return '중국'
  }
  return label
}

function megaMenuTabById(regionId: string): MegaMenuTabDef | null {
  return MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === regionId) ?? null
}

function collectTermsForMegaMenuGroup(group: MegaMenuCountryGroupDef): string[] {
  const out: string[] = []
  const header = group.countryLabel.trim()
  if (header) out.push(header)
  for (const leaf of group.cities) {
    const leafLabel = leaf.label.trim()
    if (leafLabel) out.push(leafLabel)
    for (const term of leaf.terms) {
      const t = term.trim()
      if (t) out.push(t)
    }
  }
  return out
}

function findMegaMenuGroupForLeafLabel(tab: MegaMenuTabDef, leafLabel: string): MegaMenuCountryGroupDef | null {
  const norm = leafLabel.trim().toLowerCase()
  if (!norm) return null
  for (const group of tab.groups) {
    for (const leaf of group.cities) {
      if (leaf.label.trim().toLowerCase() === norm) return group
      if (leaf.terms.some((t) => t.trim().toLowerCase() === norm)) return group
    }
  }
  return null
}

/** 트리 라벨(시즈오카 · 이즈 등) — leaf·term 부분 포함 시 그룹 */
function findMegaMenuGroupForPartialLeafLabel(
  tab: MegaMenuTabDef,
  label: string,
  stopTerms?: Set<string>,
): MegaMenuCountryGroupDef | null {
  const norm = label.trim().toLowerCase()
  if (!norm) return null

  let bestGroup: MegaMenuCountryGroupDef | null = null
  let bestLen = 0

  for (const group of tab.groups) {
    for (const leaf of group.cities) {
      for (const raw of [leaf.label, ...leaf.terms]) {
        const term = raw.trim()
        const low = term.toLowerCase()
        if (term.length < 2 || (stopTerms?.has(low) ?? false)) continue
        if (!norm.includes(low)) continue
        if (term.length > bestLen) {
          bestLen = term.length
          bestGroup = group
        }
      }
    }
  }

  return bestGroup
}

let japanSubgroupStopTermsCache: Set<string> | null = null

/** 일본 탭 — 2개 이상 도시 leaf에 공통인 토큰(일본 등)은 그룹 매칭에서 제외 */
function japanMegaMenuSubgroupStopTerms(): Set<string> {
  if (japanSubgroupStopTermsCache) return japanSubgroupStopTermsCache

  const tab = megaMenuTabById('japan')
  const termHits = new Map<string, number>()
  if (tab) {
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        const seenInLeaf = new Set<string>()
        for (const raw of [leaf.label, ...leaf.terms]) {
          const t = raw.trim().toLowerCase()
          if (t.length < 2 || seenInLeaf.has(t)) continue
          seenInLeaf.add(t)
          termHits.set(t, (termHits.get(t) ?? 0) + 1)
        }
      }
    }
  }

  const stops = new Set<string>(['일본', 'japan'])
  for (const [term, count] of termHits) {
    if (count >= 2) stops.add(term)
  }
  japanSubgroupStopTermsCache = stops
  return stops
}

/** 미주 탭 — 도시 공통어 `미국` 등은 그룹 매칭에서 제외(미서부·미동부 오분류 방지) */
function americasMegaMenuSubgroupStopTerms(): Set<string> {
  return new Set(['미국', 'usa', '미주', 'americas', 'united states'])
}

const AMERICAS_EAST_CITY_KEYS = new Set([
  'new-york',
  'nyc',
  'washington',
  'washington-dc',
  'boston',
  'philadelphia',
])

const AMERICAS_WEST_CITY_KEYS = new Set([
  'la',
  'los-angeles',
  'las-vegas',
  'lasvegas',
  'san-francisco',
  'sf',
  'san-diego',
  'seattle',
  'grandcanyon',
  'grand-canyon',
])

const AMERICAS_CANADA_CITY_KEYS = new Set([
  'vancouver',
  'toronto',
  'calgary',
  'quebec',
  'montreal',
  'banff',
  'niagara',
  'yellowknife',
])

const AMERICAS_HAWAII_CITY_KEYS = new Set(['honolulu', 'maui', 'hilo', 'kona', 'kauai', 'hawaii', 'oahu'])

const AMERICAS_ALASKA_TEXT = ['알래스카', 'alaska', '앵커리지', 'anchorage']

const AMERICAS_CANADA_TEXT = [
  '캐나다',
  'canada',
  '밴쿠버',
  'vancouver',
  '토론토',
  'toronto',
  '밴프',
  'banff',
  '나이아가라',
  'niagara',
  '몬트리올',
  'montreal',
  '퀘벡',
  'quebec',
  '옐로우나이프',
  'yellowknife',
]

const AMERICAS_EAST_TEXT = [
  '미동부',
  '미국동부',
  'us-east',
  '뉴욕',
  'new york',
  'nyc',
  '워싱턴',
  'washington',
  '보스턴',
  'boston',
  '필라델피아',
  'philadelphia',
]

const AMERICAS_WEST_TEXT = [
  '미서부',
  '미국서부',
  'us-west',
  '로스앤젤레스',
  'los angeles',
  '라스베가스',
  'las vegas',
  '샌프란시스코',
  'san francisco',
  '샌디에이고',
  'san diego',
  '시애틀',
  'seattle',
  '5대캐년',
  '5대 캐년',
  '그랜드캐년',
  'grand canyon',
  '세도나',
  'sedona',
  '요세미티',
  'yosemite',
  '브라이스',
  'bryce',
  '자이언',
  'zion',
  '모뉴먼트밸리',
  'monument valley',
  '프레스노',
  'fresno',
]

const AMERICAS_HAWAII_TEXT = ['하와이', 'hawaii', '호놀룰루', 'honolulu', '오아후', 'oahu', '마우이', 'maui']

function scoreAmericasTextTerms(haystack: string, labels: string[], terms: string[]): number {
  let score = 0
  for (const term of terms) {
    if (termAppearsInHaystack(term, haystack)) score += term.length
    for (const label of labels) {
      if (label.toLowerCase().includes(term.toLowerCase())) score += term.length
    }
  }
  return score
}

function resolveAmericasSubgroupHint(
  haystack: string,
  labels: string[],
  cityKeys: readonly string[],
): string | null {
  const keys = cityKeys.map((k) => k.trim().toLowerCase()).filter(Boolean)

  if (keys.some((k) => AMERICAS_HAWAII_CITY_KEYS.has(k))) return '하와이'
  if (keys.some((k) => AMERICAS_CANADA_CITY_KEYS.has(k))) return '캐나다'
  if (keys.some((k) => AMERICAS_EAST_CITY_KEYS.has(k)) && !keys.some((k) => AMERICAS_WEST_CITY_KEYS.has(k))) {
    return '미동부'
  }
  if (keys.some((k) => AMERICAS_WEST_CITY_KEYS.has(k)) && !keys.some((k) => AMERICAS_EAST_CITY_KEYS.has(k))) {
    return '미서부'
  }

  for (const term of AMERICAS_ALASKA_TEXT) {
    if (termAppearsInHaystack(term, haystack)) return '알래스카'
  }

  const canadaScore = scoreAmericasTextTerms(haystack, labels, AMERICAS_CANADA_TEXT)
  const hawaiiScore = scoreAmericasTextTerms(haystack, labels, AMERICAS_HAWAII_TEXT)
  const eastScore = scoreAmericasTextTerms(haystack, labels, AMERICAS_EAST_TEXT)
  const westScore = scoreAmericasTextTerms(haystack, labels, AMERICAS_WEST_TEXT)

  const hasEastToken = eastScore > 0
  const hasWestToken = westScore > 0

  if (hasEastToken && hasWestToken) {
    if (canadaScore >= Math.max(eastScore, westScore)) return '캐나다'
    const ie = haystack.indexOf('미동부')
    const iw = haystack.indexOf('미서부')
    if (ie >= 0 && iw >= 0) return ie <= iw ? '미동부' : '미서부'
    return eastScore >= westScore ? '미동부' : '미서부'
  }

  const ranked = [
    { label: '캐나다', score: canadaScore },
    { label: '하와이', score: hawaiiScore },
    { label: '미동부', score: eastScore },
    { label: '미서부', score: westScore },
  ].sort((a, b) => b.score - a.score)

  if (ranked[0]!.score > 0) return ranked[0]!.label
  return null
}

function findMegaMenuGroupForCountryLabel(tab: MegaMenuTabDef, countryLabel: string): MegaMenuCountryGroupDef | null {
  const norm = countryLabel.trim()
  if (!norm) return null
  return tab.groups.find((g) => g.countryLabel.trim() === norm) ?? null
}

function findMegaMenuLeafByLabel(tab: MegaMenuTabDef, label: string): MegaMenuLeafDef | null {
  const norm = label.trim().toLowerCase()
  if (!norm) return null
  for (const group of tab.groups) {
    for (const leaf of group.cities) {
      if (leaf.label.trim().toLowerCase() === norm) return leaf
      if (leaf.terms.some((t) => t.trim().toLowerCase() === norm)) return leaf
    }
  }
  return null
}

function bestMegaMenuLeafInTab(
  tab: MegaMenuTabDef,
  haystack: string,
): { group: MegaMenuCountryGroupDef; leaf: MegaMenuLeafDef; term: string } | null {
  let best: { group: MegaMenuCountryGroupDef; leaf: MegaMenuLeafDef; term: string } | null = null

  for (const group of tab.groups) {
    for (const leaf of group.cities) {
      for (const raw of [leaf.label, ...leaf.terms]) {
        const term = raw.trim()
        if (term.length < 2 && !SINGLE_CHAR_GEO_TERMS.has(term)) continue
        if (!termAppearsInHaystack(term, haystack)) continue
        if (!best || term.length > best.term.length) {
          best = { group, leaf, term }
        }
      }
    }
  }

  return best
}

function findMegaMenuLeafByCityKey(tab: MegaMenuTabDef, cityKey: string): MegaMenuLeafDef | null {
  const want = cityKey.trim().toLowerCase()
  if (!want) return null
  for (const group of tab.groups) {
    for (const leaf of group.cities) {
      const slug = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
      if (resolveBrowseCityKeysForFilter(slug).some((ck) => ck.trim().toLowerCase() === want)) {
        return leaf
      }
    }
  }
  return null
}

function resolveSouthAmericaSubgroupLabel(
  tab: MegaMenuTabDef,
  product: OverseasProductMatchInput,
  match: MatchProductToOverseasNodeResult | null,
  haystack: string,
  countryRowLabel?: string | null,
): string {
  const labelCandidates = [countryRowLabel, match?.leafLabel, match?.countryLabel].filter(
    (v): v is string => Boolean(v?.trim()),
  )
  for (const label of labelCandidates) {
    const leaf = findMegaMenuLeafByLabel(tab, label)
    if (leaf) return leaf.label.trim()
  }

  for (const ck of collectCandidateCityKeys(product, match, haystack)) {
    const leaf = findMegaMenuLeafByCityKey(tab, ck)
    if (leaf) return leaf.label.trim()
  }

  const bestLeaf = bestMegaMenuLeafInTab(tab, haystack)
  if (bestLeaf) return bestLeaf.leaf.label.trim()

  return '기타'
}

function collectCandidateCityKeys(
  product: OverseasProductMatchInput,
  match: MatchProductToOverseasNodeResult | null,
  haystack: string,
): string[] {
  const ordered: string[] = []
  const seen = new Set<string>()
  const push = (raw: string | null | undefined) => {
    const k = (raw ?? '').trim()
    if (!k || seen.has(k)) return
    seen.add(k)
    ordered.push(k)
  }

  const pushClusterAliases = (raw: string | null | undefined) => {
    const k = (raw ?? '').trim()
    if (!k) return
    const expanded = CLUSTER_CITY_EXPANSIONS[k]
    if (!expanded) return
    for (const row of expanded) push(row.cityKey)
  }

  push(product.cityKey)
  push(product.nodeKey)
  pushClusterAliases(product.nodeKey)
  push(product.countryKey)
  for (const tag of product.cityTags ?? []) push(tag.cityKey)
  for (const tag of product.countryTags ?? []) {
    push(tag.nodeKey)
    pushClusterAliases(tag.nodeKey)
    push(tag.countryKey)
  }
  if (match?.leafKey) {
    push(match.leafKey)
    pushClusterAliases(match.leafKey)
  }
  if (match?.countryKey) push(match.countryKey)
  for (const ck of matchMegaMenuCityKeysInHaystack(haystack)) push(ck)

  return ordered
}

function resolveMegaMenuGroupFromCityKeys(
  regionId: string,
  cityKeys: readonly string[],
): MegaMenuCountryGroupDef | null {
  for (const ck of cityKeys) {
    const placement = megaMenuPlacementForCityKey(ck)
    if (placement?.regionId !== regionId) continue
    const group = findMegaMenuGroup(regionId, placement.menuGroupSlug)
    if (group) return group
  }
  return null
}

/** 중국/홍콩/마카오/몽골 — 마스터 키·트리 라벨 보정(서안·내몽골 등) */
const CHINA_HK_MO_MONGOLIA_CITY_KEYS = new Set([
  'inner-mongolia',
  'mongolia-inner',
  'mongolia',
  'ulaanbaatar',
  'terelj',
  'hulunbuir',
  'ordos',
  'chifeng',
])

const CHINA_HK_MO_MONGOLIA_TEXT = [
  '내몽골',
  '내몽고',
  'inner mongolia',
  'inner-mongolia',
  'mongolia-inner',
  '후룬베이얼',
  'hulunbuir',
  '오르도스',
  'ordos',
  '적봉',
  '치펑',
  'chifeng',
]

const CHINA_HK_MO_CHINA_EXTRA_CITY_KEYS = new Set(['xian', 'xian-urumqi', 'urumqi', 'xiamen', 'fuzhou'])

const CHINA_HK_MO_CHINA_EXTRA_TEXT = [
  '서안',
  "xi'an",
  'xian',
  '우루무치',
  'urumqi',
  '샤먼',
  '하문',
  'xiamen',
  '푸저우',
  '복주',
  'fuzhou',
]

const CHINA_HK_MO_HUANGSHAN_CITY_KEYS = new Set(['huangshan'])

const CHINA_HK_MO_HUANGSHAN_TEXT = ['황산', 'huangshan', '운곡케이블카', '운곡', '태평']

/** 장야 七彩丹霞 — 황산(黄山)과 별도 목적지 */
const CHINA_HK_MO_ZHANGYE_CITY_KEYS = new Set(['zhangye', 'danxia'])

const CHINA_HK_MO_ZHANGYE_TEXT = ['장야', 'zhangye', '张掖', '七彩', '丹霞', '다채', '쪼한']

const EUROPE_ME_CAUCASUS_CITY_KEYS = new Set([
  'caucasus',
  'georgia',
  'azerbaijan',
  'armenia',
  'tbilisi',
  'baku',
  'yerevan',
])

/** 동유럽 countryTag·도시 키 — primary 오스트리아여도 중분류는 동유럽 */
const EUROPE_ME_EASTERN_COUNTRY_KEYS = new Set([
  'czech',
  'hungary',
  'poland',
  'croatia',
  'slovenia',
  'prague',
  'warsaw',
])

const EUROPE_ME_EASTERN_TEXT = [
  '동유럽',
  '체코',
  'czech',
  '프라하',
  'prague',
  '헝가리',
  'hungary',
  '부다페스트',
  'budapest',
  '폴란드',
  'poland',
  '바르샤바',
  'warsaw',
  '크로아티아',
  'croatia',
  '슬로베니아',
  'slovenia',
  '발칸',
  'balkans',
  '브르노',
  'brno',
  '잘츠부르크',
  'salzburg',
]

const EUROPE_ME_CAUCASUS_TEXT = [
  '코카서스',
  '카카서스',
  'caucasus',
  '조지아',
  'georgia',
  '트빌리시',
  'tbilisi',
  '아제르바이잔',
  'azerbaijan',
  '바쿠',
  'baku',
  '아르메니아',
  'armenia',
  '예레반',
  'yerevan',
]

function resolveChinaHuangshanOrZhangyeHint(
  haystack: string,
  labels: string[],
  cityKeys: readonly string[],
): '중국' | null {
  const keys = cityKeys.map((k) => k.trim().toLowerCase()).filter(Boolean)

  const hasZhangyeKey = keys.some((k) => CHINA_HK_MO_ZHANGYE_CITY_KEYS.has(k))
  const hasZhangyeText =
    CHINA_HK_MO_ZHANGYE_TEXT.some((t) => termAppearsInHaystack(t, haystack)) ||
    labels.some((l) => CHINA_HK_MO_ZHANGYE_TEXT.some((t) => l.toLowerCase().includes(t.toLowerCase())))

  if (hasZhangyeKey || hasZhangyeText) return '중국'

  const hasHuangshanKey = keys.some((k) => CHINA_HK_MO_HUANGSHAN_CITY_KEYS.has(k))
  const hasHuangshanText =
    CHINA_HK_MO_HUANGSHAN_TEXT.some((t) => termAppearsInHaystack(t, haystack)) ||
    labels.some((l) => CHINA_HK_MO_HUANGSHAN_TEXT.some((t) => l.toLowerCase().includes(t.toLowerCase())))

  if (hasHuangshanKey || (hasHuangshanText && !hasZhangyeText)) return '중국'

  return null
}

function productHasEuropeEasternCountrySignal(
  product: OverseasProductMatchInput,
  haystack: string,
  cityKeys: readonly string[],
  match: MatchProductToOverseasNodeResult | null,
): boolean {
  const tagKeys = (product.countryTags ?? [])
    .map((t) => (t.countryKey ?? '').trim().toLowerCase())
    .filter(Boolean)
  if (tagKeys.some((k) => EUROPE_ME_EASTERN_COUNTRY_KEYS.has(k))) return true

  const keys = [
    ...cityKeys.map((k) => k.trim().toLowerCase()),
    (match?.countryKey ?? '').trim().toLowerCase(),
    (match?.leafKey ?? '').trim().toLowerCase(),
  ].filter(Boolean)
  if (keys.some((k) => EUROPE_ME_EASTERN_COUNTRY_KEYS.has(k))) return true

  return EUROPE_ME_EASTERN_TEXT.some((t) => termAppearsInHaystack(t, haystack))
}

function resolveEuropeMeEasternWesternHint(
  product: OverseasProductMatchInput,
  haystack: string,
  cityKeys: readonly string[],
  match: MatchProductToOverseasNodeResult | null,
): '동유럽' | null {
  if (productHasEuropeEasternCountrySignal(product, haystack, cityKeys, match)) return '동유럽'
  return null
}

function resolveEuropeMeCaucasusHint(
  haystack: string,
  labels: string[],
  cityKeys: readonly string[],
  match: MatchProductToOverseasNodeResult | null,
): '코카서스 3국' | null {
  const keys = [
    ...cityKeys.map((k) => k.trim().toLowerCase()),
    (match?.countryKey ?? '').trim().toLowerCase(),
    (match?.leafKey ?? '').trim().toLowerCase(),
  ].filter(Boolean)

  if (keys.some((k) => EUROPE_ME_CAUCASUS_CITY_KEYS.has(k))) return '코카서스 3국'
  if (detectCaucasusPackageFromKeys(keys)) return '코카서스 3국'
  if (detectCaucasusPackageFromHaystack(haystack)) return '코카서스 3국'

  for (const term of EUROPE_ME_CAUCASUS_TEXT) {
    if (termAppearsInHaystack(term, haystack)) return '코카서스 3국'
  }
  for (const label of labels) {
    const low = label.toLowerCase()
    if (EUROPE_ME_CAUCASUS_TEXT.some((t) => low.includes(t.toLowerCase()))) return '코카서스 3국'
    if (detectCaucasusPackageFromHaystack(label)) return '코카서스 3국'
  }

  return null
}

function resolveChinaHkMoSubgroupHint(
  haystack: string,
  labels: string[],
  cityKeys: readonly string[],
  match: MatchProductToOverseasNodeResult | null,
): '몽골' | '중국' | null {
  const keys = [
    ...cityKeys.map((k) => k.trim().toLowerCase()),
    (match?.countryKey ?? '').trim().toLowerCase(),
    (match?.leafKey ?? '').trim().toLowerCase(),
  ].filter(Boolean)

  if (keys.some((k) => CHINA_HK_MO_MONGOLIA_CITY_KEYS.has(k))) return '몽골'

  for (const term of CHINA_HK_MO_MONGOLIA_TEXT) {
    if (termAppearsInHaystack(term, haystack)) return '몽골'
  }
  for (const label of labels) {
    const low = label.toLowerCase()
    if (CHINA_HK_MO_MONGOLIA_TEXT.some((t) => low.includes(t.toLowerCase()))) return '몽골'
  }

  if (keys.some((k) => CHINA_HK_MO_CHINA_EXTRA_CITY_KEYS.has(k))) return '중국'

  for (const term of CHINA_HK_MO_CHINA_EXTRA_TEXT) {
    if (termAppearsInHaystack(term, haystack)) return '중국'
  }
  for (const label of labels) {
    if (label.includes('서안') || label.includes('우루무치')) return '중국'
  }

  return null
}

function bestMegaMenuGroupInTab(
  tab: MegaMenuTabDef,
  haystack: string,
  stopTerms?: Set<string>,
): MegaMenuCountryGroupDef | null {
  let bestGroup: MegaMenuCountryGroupDef | null = null
  let bestLen = 0

  for (const group of tab.groups) {
    for (const term of collectTermsForMegaMenuGroup(group)) {
      if (term.length < 2 && !SINGLE_CHAR_GEO_TERMS.has(term)) continue
      if (stopTerms?.has(term.trim().toLowerCase())) continue
      if (!termAppearsInHaystack(term, haystack)) continue
      if (term.length > bestLen) {
        bestLen = term.length
        bestGroup = group
      }
    }
  }

  return bestGroup
}

/** browse 목록 하위 지역 행 라벨 — 메가메뉴 countryGroup 기준 */
export function resolveOverseasMegaMenuSubgroupLabelForBrowse(
  product: OverseasProductMatchInput,
  match: MatchProductToOverseasNodeResult | null,
  regionId: string,
  countryRowLabel?: string | null,
): string {
  const tab = megaMenuTabById(regionId)
  if (!tab?.groups.length) return '기타'

  const haystack = buildOverseasProductMatchHaystack(product)
  const cityKeys = collectCandidateCityKeys(product, match, haystack)

  const labelCandidates = [countryRowLabel, match?.leafLabel, match?.countryLabel, product.primaryDestination ?? '']
    .filter((v): v is string => Boolean(v?.trim()))

  if (regionId === 'china-hk-mo') {
    const huangZhangyeHint = resolveChinaHuangshanOrZhangyeHint(haystack, labelCandidates, cityKeys)
    if (huangZhangyeHint) return huangZhangyeHint

    const chinaHint = resolveChinaHkMoSubgroupHint(haystack, labelCandidates, cityKeys, match)
    if (chinaHint) return chinaHint
  }

  if (regionId === 'europe-me') {
    const caucasusHint = resolveEuropeMeCaucasusHint(haystack, labelCandidates, cityKeys, match)
    if (caucasusHint) return caucasusHint
    const easternHint = resolveEuropeMeEasternWesternHint(product, haystack, cityKeys, match)
    if (easternHint) return easternHint
  }

  if (regionId === 'south-america') {
    return resolveSouthAmericaSubgroupLabel(tab, product, match, haystack, countryRowLabel)
  }

  if (regionId === 'americas') {
    const americasHint = resolveAmericasSubgroupHint(
      haystack,
      [countryRowLabel, match?.leafLabel, match?.countryLabel, product.primaryDestination ?? '']
        .filter((v): v is string => Boolean(v?.trim())),
      cityKeys,
    )
    if (americasHint) return americasHint
  }

  const subgroupStopTerms =
    regionId === 'japan'
      ? japanMegaMenuSubgroupStopTerms()
      : regionId === 'americas'
        ? americasMegaMenuSubgroupStopTerms()
        : undefined
  const countryRow = (countryRowLabel ?? '').trim()
  const skipGenericJapanCountryRow =
    regionId === 'japan' && ['일본', 'japan'].includes(countryRow.toLowerCase())

  if (countryRow && !skipGenericJapanCountryRow) {
    const fromRow = findMegaMenuGroupForLeafLabel(tab, countryRow)
    if (fromRow) return megaMenuGroupToDisplayLabel(regionId, fromRow.countryLabel)
    const fromPartialRow = findMegaMenuGroupForPartialLeafLabel(tab, countryRow, subgroupStopTerms)
    if (fromPartialRow) return megaMenuGroupToDisplayLabel(regionId, fromPartialRow.countryLabel)
    const fromCountryGroup = findMegaMenuGroupForCountryLabel(tab, countryRow)
    if (fromCountryGroup) return megaMenuGroupToDisplayLabel(regionId, fromCountryGroup.countryLabel)
  }

  const fromCityKeys = resolveMegaMenuGroupFromCityKeys(regionId, cityKeys)
  if (fromCityKeys) {
    return megaMenuGroupToDisplayLabel(regionId, fromCityKeys.countryLabel)
  }

  const bestGroup = bestMegaMenuGroupInTab(tab, haystack, subgroupStopTerms)
  if (bestGroup) {
    return megaMenuGroupToDisplayLabel(regionId, bestGroup.countryLabel)
  }

  if (match?.leafLabel?.trim()) {
    const fromLeaf = findMegaMenuGroupForLeafLabel(tab, match.leafLabel)
    if (fromLeaf) return megaMenuGroupToDisplayLabel(regionId, fromLeaf.countryLabel)
    const fromPartialLeaf = findMegaMenuGroupForPartialLeafLabel(tab, match.leafLabel, subgroupStopTerms)
    if (fromPartialLeaf) return megaMenuGroupToDisplayLabel(regionId, fromPartialLeaf.countryLabel)
  }

  if (match?.countryLabel?.trim()) {
    const fromCountry = findMegaMenuGroupForCountryLabel(tab, match.countryLabel)
    if (fromCountry) return megaMenuGroupToDisplayLabel(regionId, fromCountry.countryLabel)
    const fromCountryLeaf = findMegaMenuGroupForLeafLabel(tab, match.countryLabel)
    if (fromCountryLeaf) return megaMenuGroupToDisplayLabel(regionId, fromCountryLeaf.countryLabel)
  }

  return '기타'
}

/** 허브 클라이언트 — `countryRowLabel`만으로 하위분류(메가 countryGroup) 라벨 해석 */
export function resolveOverseasMegaMenuSubgroupLabelFromCountryRow(
  regionId: string,
  countryRowLabel: string | null | undefined,
): string | null {
  const tab = megaMenuTabById(regionId)
  if (!tab?.groups.length) return null

  const subgroupStopTerms =
    regionId === 'japan'
      ? japanMegaMenuSubgroupStopTerms()
      : regionId === 'americas'
        ? americasMegaMenuSubgroupStopTerms()
        : undefined
  const countryRow = (countryRowLabel ?? '').trim()
  const skipGenericJapanCountryRow =
    regionId === 'japan' && ['일본', 'japan'].includes(countryRow.toLowerCase())

  if (!countryRow || skipGenericJapanCountryRow) return null

  const fromRow = findMegaMenuGroupForLeafLabel(tab, countryRow)
  if (fromRow) return megaMenuGroupToDisplayLabel(regionId, fromRow.countryLabel)
  const fromPartialRow = findMegaMenuGroupForPartialLeafLabel(tab, countryRow, subgroupStopTerms)
  if (fromPartialRow) return megaMenuGroupToDisplayLabel(regionId, fromPartialRow.countryLabel)
  const fromCountryGroup = findMegaMenuGroupForCountryLabel(tab, countryRow)
  if (fromCountryGroup) return megaMenuGroupToDisplayLabel(regionId, fromCountryGroup.countryLabel)

  return null
}

/** 클라이언트 폴백 — browse API 필드가 비었을 때 title·목적지·countryRowLabel로 재매칭 */
export function resolveOverseasMegaMenuSubgroupLabelForClient(
  item: {
    title: string
    primaryDestination?: string | null
    primaryRegion?: string | null
    countryRowLabel?: string | null
  },
  regionId: string,
): string {
  return resolveOverseasMegaMenuSubgroupLabelForBrowse(
    {
      title: item.title,
      primaryDestination: item.primaryDestination ?? null,
      destination: item.primaryDestination ?? null,
      primaryRegion: item.primaryRegion ?? null,
      destinationRaw: null,
      originSource: '',
    },
    null,
    regionId,
    item.countryRowLabel,
  )
}

/** 메가메뉴 탭 — 하위 지역(그룹) 라벨 표시 순서 */
export function megaMenuSubgroupLabelsInOrder(regionId: string): string[] {
  const override = SUBGROUP_DISPLAY_ORDER_OVERRIDE[regionId]
  if (override) return [...override]

  const tab = megaMenuTabById(regionId)
  if (!tab) return []

  const seen = new Set<string>()
  const out: string[] = []
  for (const group of tab.groups) {
    const label = megaMenuGroupToDisplayLabel(regionId, group.countryLabel)
    if (!seen.has(label)) {
      seen.add(label)
      out.push(label)
    }
  }
  return out
}

export function megaMenuRegionTabLabel(regionId: string): string | null {
  return megaMenuTabById(regionId)?.label ?? null
}

function spGet(sp: URLSearchParams, key: string): string {
  return (sp.get(key) ?? '').trim()
}

/**
 * 메가메뉴 대분류만 선택(`region`만, country/city 없음) → 하위 지역별 섹션 그룹 id.
 * 해당 없으면 null.
 */
export function computeMegaMenuRegionCityGroupId(opts: {
  pathname: string
  defaultScope?: 'overseas' | 'domestic'
  searchParams: URLSearchParams
  overseasGeoFilterBanner?: OverseasGeoFilterBanner | null
}): string | null {
  const isOverseasHub = opts.pathname === '/travel/overseas' && opts.defaultScope === 'overseas'
  if (!isOverseasHub) return null

  const q = parseBrowseQuery(new URLSearchParams(opts.searchParams.toString()))
  const region = (q.region ?? '').trim()
  if (!isMegaMenuRegionCityGroupTabId(region)) return null
  if ((q.country ?? '').trim()) return null
  if ((q.city ?? '').trim()) return null
  if (spGet(opts.searchParams, 'destination')) return null
  if (opts.overseasGeoFilterBanner) return null
  if (spGet(opts.searchParams, 'hubSeason')) return null

  return region
}

export function computeMegaMenuRegionCityGroupIdFromRecord(
  sp: Record<string, string | string[] | undefined>,
  opts: Omit<Parameters<typeof computeMegaMenuRegionCityGroupId>[0], 'searchParams'>,
): string | null {
  return computeMegaMenuRegionCityGroupId({
    ...opts,
    searchParams: searchParamsRecordToUrlSearchParams(sp),
  })
}
