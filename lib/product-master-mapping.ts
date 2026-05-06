/**
 * I-3: 트리 키(groupKey / countryKey / nodeKey) → SSOT 마스터(Continent / Country / City) 키 추론.
 * 트리 데이터 SSOT(`lib/overseas-location-tree.data.ts`)는 수정하지 않으며, `scripts/seed-master-data.ts` 분기와 맞춘다.
 */
import {
  findGroupKeyForCountryKey,
  findLeafInTree,
} from '@/lib/overseas-location-tree'

/** 시드 `CLUSTER_EXPANSIONS`와 동일 — 2개 이상 도시로 펼쳐지는 트리 nodeKey */
const MULTI_CITY_CLUSTER_NODE_KEYS = new Set<string>([
  'shandong',
  'phuket-krabi-khaolak',
  'chiangmai-chiangrai',
  'hanoi-halong',
  'hue-donghoi',
  'shizuoka-izu',
  'hakone-fuji',
  'yokohama-kamakura',
  'beppu-yufuin',
  'kumamoto-nagasaki',
  'kagoshima-miyazaki',
  'kitakyushu-yamaguchi',
  'furano-biei',
  'toya-jozankei',
  'wakayama-shirahama',
  'takamatsu-naoshima',
  'akita-sendai',
  'beijing-tianjin',
  'sichuan',
  'yunnan',
  'dalian-harbin',
  'xian-urumqi',
  'wuhan-yichang',
  'changbai',
  'dallas-houston',
  'orlando-miami',
  'cuba-mexico',
  'quebec',
  'kanazawa-komatsu',
  'toyama-alpen',
])

/** 발트 3국 등 — 시드 전용 다도시 리프 */
const MULTI_CITY_SPECIAL_NODE_KEYS = new Set(['baltic3'])

/** 단일 Product 행에 접기 어려운 다국가·연계 리프 */
const AMBIGUOUS_MULTI_COUNTRY_NODE_KEYS = new Set([
  'balkan-mix',
  'south-america',
  'sg-batam',
  'my-link',
])

const TREE_THEME_OR_MULTI_ROUTE_COUNTRIES = new Set([
  'sea-multi',
  'buddhist-pilgrimage',
  'europe-pilgrimage',
  'china-trekking',
  'sports-tours',
])

const TREE_COUNTRY_CANONICAL: Record<string, string> = {
  'jp-kanto': 'japan',
  'jp-kansai': 'japan',
  'jp-kyushu': 'japan',
  'jp-hokkaido': 'japan',
  'jp-shikoku-chugoku': 'japan',
  'jp-okinawa': 'japan',
  'jp-chubu-hokuriku': 'japan',
  'jp-tohoku': 'japan',
  'jp-ferry': 'japan',
  'china-major': 'china',
  'inner-mongolia': 'china',
  'hk-mo-sz': 'china',
  'usa-west': 'united-states',
  'usa-east': 'united-states',
  'usa-south': 'united-states',
  hawaii: 'united-states',
  alaska: 'united-states',
}

/** nodeKey 없이는 마스터 국가를 특정할 수 없는 트리 countryKey */
const TREE_COUNTRY_REQUIRES_NODEKEY = new Set([
  'india-nepal-sri-bhutan',
  'malaysia-brunei',
  'hk-mo-sz',
  'netherlands',
  'uk',
  'middle-east',
])

export function continentForGroupAndTreeCountry(
  groupKey: string,
  treeCountryKey: string,
): string | null {
  if (groupKey === 'japan') return 'northeast-asia'
  if (groupKey === 'china-circle') return 'northeast-asia'
  if (groupKey === 'sea-taiwan-south-asia') {
    if (treeCountryKey === 'india-nepal-sri-bhutan' || treeCountryKey === 'maldives')
      return 'south-asia'
    if (treeCountryKey === 'taiwan') return 'southeast-asia'
    return 'southeast-asia'
  }
  if (groupKey === 'guam-au-nz') return 'oceania'
  if (groupKey === 'americas') {
    if (treeCountryKey === 'latin-caribbean') return 'south-america'
    return 'north-america'
  }
  if (groupKey === 'europe-me-africa') {
    if (
      treeCountryKey === 'middle-east' ||
      treeCountryKey === 'turkey' ||
      treeCountryKey === 'caucasus'
    )
      return 'middle-east'
    if (
      treeCountryKey === 'africa' ||
      treeCountryKey === 'morocco' ||
      treeCountryKey === 'egypt'
    )
      return 'africa'
    return 'europe'
  }
  return 'europe'
}

export function isMultiCityClusterNode(nodeKey: string | null | undefined): boolean {
  if (!nodeKey?.trim()) return false
  const k = nodeKey.trim()
  return MULTI_CITY_CLUSTER_NODE_KEYS.has(k) || MULTI_CITY_SPECIAL_NODE_KEYS.has(k)
}

export function titleSuggestsMultiCountryPackage(title: string | null | undefined): boolean {
  if (!title?.trim()) return false
  return /\d+\s*국(\s|패키지|연계|일주|순회|투어|$)/.test(title)
}

const CHAOS_REGION_HANGUL =
  /동유럽|서유럽|북유럽|중유럽|남유럽|스칸디나비아|발칸|중남미|남태평양|미서부|미동부|남아프리카|북아프리카|중동일주/

export function looksLikeChaosRegionLabel(s: string | null | undefined): boolean {
  if (!s?.trim()) return false
  return CHAOS_REGION_HANGUL.test(s.trim())
}

export type MapTreeKeysInput = {
  groupKey?: string | null
  /** 트리 OverseasCountryNode.countryKey (일본 권역·다국가 묶음 등) */
  countryKey?: string | null
  nodeKey?: string | null
}

export type MapTreeKeysResult = {
  continentKey: string | null
  /** 마스터 `Country.countryKey` (스크립트는 DB 컬럼으로 저장하지 않고 검증·보조에만 사용) */
  masterCountryKey: string | null
  cityKey: string | null
  reasons: string[]
}

function pushReason(reasons: string[], code: string) {
  if (!reasons.includes(code)) reasons.push(code)
}

function resolveTreeCountryAndCity(
  treeCk: string,
  nodeKey: string | null,
  reasons: string[],
): { masterCountryKey: string | null; cityKey: string | null } {
  if (TREE_COUNTRY_REQUIRES_NODEKEY.has(treeCk)) {
    if (!nodeKey?.trim()) {
      pushReason(reasons, 'tree_country_requires_nodekey')
      return { masterCountryKey: null, cityKey: null }
    }
  }

  if (nodeKey?.trim() && AMBIGUOUS_MULTI_COUNTRY_NODE_KEYS.has(nodeKey.trim())) {
    pushReason(reasons, 'ambiguous_multi_country_leaf')
    return { masterCountryKey: null, cityKey: null }
  }

  if (nodeKey?.trim() && isMultiCityClusterNode(nodeKey)) {
    pushReason(reasons, 'multi_city_cluster')
  }

  const nk = nodeKey?.trim() ?? ''

  if (treeCk === 'india-nepal-sri-bhutan') {
    const map: Record<string, string> = {
      india: 'india',
      nepal: 'nepal',
      srilanka: 'srilanka',
      bhutan: 'bhutan',
    }
    const masterCountryKey = map[nk] ?? null
    if (!masterCountryKey) {
      pushReason(reasons, 'india_cluster_unknown_leaf')
      return { masterCountryKey: null, cityKey: null }
    }
    return {
      masterCountryKey,
      cityKey: isMultiCityClusterNode(nodeKey) ? null : nk || null,
    }
  }

  if (treeCk === 'malaysia-brunei') {
    if (nk === 'brunei') return { masterCountryKey: 'brunei', cityKey: 'brunei' }
    if (nk === 'kotakinabalu')
      return { masterCountryKey: 'malaysia', cityKey: 'kotakinabalu' }
    if (nk === 'kuala-lumpur')
      return { masterCountryKey: 'malaysia', cityKey: 'kuala-lumpur' }
    if (nk)
      return {
        masterCountryKey: 'malaysia',
        cityKey: isMultiCityClusterNode(nodeKey) ? null : nk,
      }
    return { masterCountryKey: null, cityKey: null }
  }

  if (treeCk === 'hk-mo-sz') {
    if (nk === 'hongkong') return { masterCountryKey: 'hong-kong', cityKey: 'hongkong' }
    if (nk === 'macau') return { masterCountryKey: 'macau', cityKey: 'macau' }
    if (nk === 'shenzhen')
      return {
        masterCountryKey: 'china',
        cityKey: isMultiCityClusterNode(nodeKey) ? null : 'shenzhen',
      }
    if (nk)
      return {
        masterCountryKey: 'china',
        cityKey: isMultiCityClusterNode(nodeKey) ? null : nk,
      }
    return { masterCountryKey: null, cityKey: null }
  }

  if (treeCk === 'netherlands') {
    if (nk === 'be')
      return {
        masterCountryKey: 'belgium',
        cityKey: isMultiCityClusterNode(nodeKey) ? null : 'belgium-mix',
      }
    if (nk)
      return {
        masterCountryKey: 'netherlands',
        cityKey: isMultiCityClusterNode(nodeKey) ? null : 'netherlands-mix',
      }
    return { masterCountryKey: null, cityKey: null }
  }

  if (treeCk === 'uk') {
    if (nk === 'ie')
      return {
        masterCountryKey: 'ireland',
        cityKey: isMultiCityClusterNode(nodeKey) ? null : 'ireland-mix',
      }
    if (nk)
      return {
        masterCountryKey: 'united-kingdom',
        cityKey: isMultiCityClusterNode(nodeKey) ? null : 'uk-mix',
      }
    return { masterCountryKey: null, cityKey: null }
  }

  if (treeCk === 'middle-east') {
    const mk: Record<string, string> = {
      dubai: 'united-arab-emirates',
      abudhabi: 'united-arab-emirates',
      jordan: 'jordan',
      saudi: 'saudi-arabia',
      oman: 'oman',
      qatar: 'qatar',
      tunisia: 'tunisia',
    }
    const masterCountryKey = mk[nk] ?? null
    if (!masterCountryKey) {
      pushReason(reasons, 'middle_east_unknown_leaf')
      return { masterCountryKey: null, cityKey: null }
    }
    const cityKey =
      nk === 'dubai' ? 'dubai' : nk === 'abudhabi' ? 'abudhabi' : nk || null
    return {
      masterCountryKey,
      cityKey: isMultiCityClusterNode(nodeKey) ? null : cityKey,
    }
  }

  if (treeCk === 'nordic-baltic') {
    const nkMap: Record<string, { c: string; cityKey: string }> = {
      norway: { c: 'norway', cityKey: 'norway-mix' },
      finland: { c: 'finland', cityKey: 'finland-mix' },
      denmark: { c: 'denmark', cityKey: 'denmark-mix' },
      sweden: { c: 'sweden', cityKey: 'sweden-mix' },
      iceland: { c: 'iceland', cityKey: 'iceland-mix' },
    }
    if (nk === 'baltic3') {
      pushReason(reasons, 'multi_city_cluster')
      return { masterCountryKey: 'lithuania', cityKey: null }
    }
    const hit = nkMap[nk]
    if (hit)
      return {
        masterCountryKey: hit.c,
        cityKey: isMultiCityClusterNode(nodeKey) ? null : hit.cityKey,
      }
    pushReason(reasons, 'nordic_unknown_leaf')
    return { masterCountryKey: null, cityKey: null }
  }

  if (treeCk === 'caucasus') {
    const ckMap: Record<string, string> = {
      georgia: 'georgia',
      azerbaijan: 'azerbaijan',
      armenia: 'armenia',
    }
    if (!nk) {
      pushReason(reasons, 'caucasus_missing_node')
      return { masterCountryKey: null, cityKey: null }
    }
    const masterCountryKey = ckMap[nk] ?? 'georgia'
    return {
      masterCountryKey,
      cityKey: isMultiCityClusterNode(nodeKey) ? null : nk,
    }
  }

  if (treeCk === 'central-asia') {
    const ckMap: Record<string, string> = {
      kazakhstan: 'kazakhstan',
      kyrgyzstan: 'kyrgyzstan',
      uzbekistan: 'uzbekistan',
    }
    if (!nk) {
      pushReason(reasons, 'central_asia_missing_node')
      return { masterCountryKey: null, cityKey: null }
    }
    const masterCountryKey = ckMap[nk] ?? 'kazakhstan'
    return {
      masterCountryKey,
      cityKey: isMultiCityClusterNode(nodeKey) ? null : nk,
    }
  }

  if (treeCk === 'africa') {
    const ak: Record<string, string> = {
      kenya: 'kenya',
      tanzania: 'tanzania',
      'south-africa': 'south-africa',
      mauritius: 'mauritius',
    }
    if (!nk) {
      pushReason(reasons, 'africa_missing_node')
      return { masterCountryKey: null, cityKey: null }
    }
    const masterCountryKey = ak[nk] ?? 'kenya'
    return {
      masterCountryKey,
      cityKey: isMultiCityClusterNode(nodeKey) ? null : nk,
    }
  }

  if (treeCk === 'balkans') {
    pushReason(reasons, 'balkans_bundle')
    return { masterCountryKey: null, cityKey: null }
  }

  if (treeCk === 'latin-caribbean') {
    if (nk === 'caribbean')
      return {
        masterCountryKey: 'dominican-republic',
        cityKey: isMultiCityClusterNode(nodeKey) ? null : 'caribbean-mix',
      }
    if (nk === 'cuba-mexico' || nk === 'south-america') {
      pushReason(reasons, 'latin_multi_country_leaf')
      return { masterCountryKey: null, cityKey: null }
    }
  }

  if (treeCk.startsWith('jp-') || treeCk === 'jp-ferry') {
    const masterCountryKey = 'japan'
    if (!nk) return { masterCountryKey, cityKey: null }
    return {
      masterCountryKey,
      cityKey: isMultiCityClusterNode(nodeKey) ? null : nk,
    }
  }

  if (treeCk === 'china-major' || treeCk === 'inner-mongolia') {
    if (!nk) return { masterCountryKey: 'china', cityKey: null }
    return {
      masterCountryKey: 'china',
      cityKey: isMultiCityClusterNode(nodeKey) ? null : nk,
    }
  }

  if (
    treeCk === 'usa-west' ||
    treeCk === 'usa-east' ||
    treeCk === 'usa-south' ||
    treeCk === 'hawaii' ||
    treeCk === 'alaska'
  ) {
    if (!nk) return { masterCountryKey: 'united-states', cityKey: null }
    return {
      masterCountryKey: 'united-states',
      cityKey: isMultiCityClusterNode(nodeKey) ? null : nk,
    }
  }

  const masterCountryKey = TREE_COUNTRY_CANONICAL[treeCk] ?? treeCk
  if (!nk)
    return {
      masterCountryKey,
      cityKey: null,
    }
  return {
    masterCountryKey,
    cityKey: isMultiCityClusterNode(nodeKey) ? null : nk,
  }
}

/**
 * 트리 슬러그 → 마스터 키. 부분 결과 허용(reasons 참고).
 * `countryKey`(트리)가 없으면 대륙·국가·도시 모두 특정하지 않는다.
 */
export function mapTreeKeysToMasterKeys(input: MapTreeKeysInput): MapTreeKeysResult {
  const reasons: string[] = []
  const treeCk = input.countryKey?.trim() ?? ''
  const nodeKey = input.nodeKey?.trim() ?? ''

  if (!treeCk) {
    pushReason(reasons, 'missing_tree_country')
    return { continentKey: null, masterCountryKey: null, cityKey: null, reasons }
  }

  let groupKey = input.groupKey?.trim() ?? ''
  if (!groupKey) groupKey = findGroupKeyForCountryKey(treeCk) ?? ''

  if (!groupKey) {
    pushReason(reasons, 'unknown_group')
    return { continentKey: null, masterCountryKey: null, cityKey: null, reasons }
  }

  const continentKey = continentForGroupAndTreeCountry(groupKey, treeCk)

  if (TREE_THEME_OR_MULTI_ROUTE_COUNTRIES.has(treeCk)) {
    pushReason(reasons, 'theme_or_multi_country_tree')
    if (nodeKey) {
      const leafHit = findLeafInTree(groupKey, treeCk, nodeKey)
      if (leafHit?.leaf.nodeType === 'theme' || leafHit?.leaf.nodeType === 'route') {
        pushReason(reasons, 'theme_route_leaf')
      }
    }
    return { continentKey, masterCountryKey: null, cityKey: null, reasons }
  }

  const leafHit = nodeKey ? findLeafInTree(groupKey, treeCk, nodeKey) : undefined
  if (leafHit?.leaf.nodeType === 'theme' || leafHit?.leaf.nodeType === 'route') {
    pushReason(reasons, 'theme_route_leaf')
  }

  const { masterCountryKey, cityKey } = resolveTreeCountryAndCity(
    treeCk,
    nodeKey || null,
    reasons,
  )

  return { continentKey, masterCountryKey, cityKey, reasons }
}
