/**
 * 해외 목적지 트리 ↔ 상품 매칭.
 * 우선순위: primaryDestination → destinationRaw → 레거시 destination → title → originSource (문자열 힙).
 * @see lib/overseas-location-tree.ts 트리 토큰
 */
import {
  OVERSEAS_LOCATION_TREE_CLEAN,
  matchTokensForCountryShallow,
  matchTokensForGroupShallow,
  matchTokensForLeaf,
  type OverseasRegionGroupNode,
} from '@/lib/overseas-location-tree'
import {
  browseRegionToDbContinents,
  dbCityMatchesBrowseCityParam,
  dbCountryMatchesBrowseCountryParam,
  dbContinentsToProductCountryTagGroupKeys,
  resolveBrowseCityParamToCountryTagNodeKeys,
  resolveBrowseCountryParamToCountryKeySlugs,
} from '@/lib/browse-country-url-resolve'
import { masterContinentKeysFromBrowseDbContinents } from '@/lib/browse-master-geo-continents'
import type { OverseasCountryNode, OverseasLeafNode } from '@/lib/overseas-location-tree.types'

/** G-3 / I-4: browse·트리 OR 매칭용 (Prisma select 최소 필드) */
export type CountryTagMatchSlice = {
  countryKey: string
  nodeKey: string | null
  groupKey: string | null
  country?: { continentKey: string } | null
}

export type CityTagMatchSlice = {
  cityKey: string
}

/** 갤러리·API 등 최소 필드 */
export type OverseasProductMatchInput = {
  title: string
  originSource: string
  primaryDestination?: string | null
  destinationRaw?: string | null
  /** 레거시 DB 필드 */
  destination?: string | null
  /** 동남아·유럽 등 1차 권역 메타 */
  primaryRegion?: string | null
  /** browse URL·메가메뉴와 동일 슬러그 — 있으면 지역 필터에서 텍스트보다 우선 */
  continent?: string | null
  country?: string | null
  city?: string | null
  /** 트리·마스터와 동일 스펙의 국가 슬러그 (`Product.countryKey`) */
  countryKey?: string | null
  /** I-3: SSOT 대륙·도시 FK */
  continentKey?: string | null
  cityKey?: string | null
  /** G-3: `ProductCountryTag` 보조 (없으면 기존 단일 geo만) */
  countryTags?: readonly CountryTagMatchSlice[]
  /** I-4: `ProductCityTag` 보조 */
  cityTags?: readonly CityTagMatchSlice[]
}

/**
 * 매칭용 단일 소문자 문자열. 필드 순서는 운영 우선순위와 동일.
 */
export function buildOverseasProductMatchHaystack(p: OverseasProductMatchInput): string {
  const parts = [
    p.primaryDestination,
    p.destinationRaw,
    p.primaryRegion,
    p.destination,
    p.title,
    p.originSource,
  ].filter((x): x is string => Boolean(x && String(x).trim()))
  return parts.join(' \n ').toLowerCase()
}

export function productMatchesOverseasDestinationTerms(
  product: OverseasProductMatchInput,
  terms: string[],
  urlGeo?: { region: string | null; country: string | null; city: string | null }
): boolean {
  const rRaw = (urlGeo?.region ?? '').trim()
  const rDbConts = browseRegionToDbContinents(rRaw).map((x) => x.toLowerCase())
  const cRaw = (urlGeo?.country ?? '').trim()
  const c = cRaw.toLowerCase()
  const ctRaw = (urlGeo?.city ?? '').trim()
  const hasUrlGeo = Boolean(rRaw || c || ctRaw)

  const dbCont = (product.continent ?? '').trim().toLowerCase()
  const dbCountry = (product.country ?? '').trim().toLowerCase()
  const dbCountryRaw = (product.country ?? '').trim()
  const dbCityRaw = (product.city ?? '').trim()
  const hasDbBrowseGeo = Boolean(dbCont || dbCountry || dbCityRaw)

  const haystack = buildOverseasProductMatchHaystack(product)
  const termsMatch = (): boolean => {
    if (terms.length === 0) return true
    return terms.some((t) => {
      const k = t.trim().toLowerCase()
      return k.length > 0 && haystack.includes(k)
    })
  }

  if (!hasUrlGeo) return termsMatch()

  const tags = product.countryTags

  const tagMatchesRegionContinent = (): boolean => {
    if (!tags?.length || !rDbConts.length) return false
    const wantGroup = new Set(dbContinentsToProductCountryTagGroupKeys(rDbConts))
    const wantMaster = new Set(masterContinentKeysFromBrowseDbContinents(rDbConts))
    return tags.some((t) => {
      const g = (t.groupKey ?? '').trim().toLowerCase()
      if (g && wantGroup.has(g)) return true
      const mc = t.country?.continentKey
      return Boolean(mc && wantMaster.has(mc))
    })
  }

  const masterProductContinentMatchesRegion = (): boolean => {
    if (!rDbConts.length || !product.continentKey?.trim()) return false
    const want = new Set(masterContinentKeysFromBrowseDbContinents(rDbConts))
    return want.has(product.continentKey.trim())
  }

  const tagMatchesCountryParam = (): boolean => {
    if (!tags?.length || !cRaw) return false
    const want = new Set(resolveBrowseCountryParamToCountryKeySlugs(cRaw).map((x) => x.toLowerCase()))
    if (want.size === 0) return false
    return tags.some((t) => want.has((t.countryKey ?? '').trim().toLowerCase()))
  }

  const tagMatchesCityParam = (): boolean => {
    if (!tags?.length || !ctRaw) return false
    const want = new Set(resolveBrowseCityParamToCountryTagNodeKeys(ctRaw).map((x) => x.toLowerCase()))
    if (want.size === 0) return false
    return tags.some((t) => {
      const nk = (t.nodeKey ?? '').trim().toLowerCase()
      return Boolean(nk) && want.has(nk)
    })
  }

  const wantMasterCityKeysForUrl = (): Set<string> => {
    const want = new Set<string>()
    if (ctRaw) {
      for (const nk of resolveBrowseCityParamToCountryTagNodeKeys(ctRaw)) {
        if (nk) want.add(nk.toLowerCase())
      }
      const low = ctRaw.trim().toLowerCase()
      if (/^[a-z0-9-]+$/.test(low)) want.add(low)
    }
    return want
  }

  const masterProductCityMatchesUrl = (): boolean => {
    if (!ctRaw) return false
    const want = wantMasterCityKeysForUrl()
    if (want.size === 0) return false
    const pk = (product.cityKey ?? '').trim().toLowerCase()
    if (pk && want.has(pk)) return true
    const ctags = product.cityTags
    if (!ctags?.length) return false
    return ctags.some((t) => want.has((t.cityKey ?? '').trim().toLowerCase()))
  }

  const masterProductCountryKeyMatchesUrl = (): boolean => {
    if (!cRaw) return false
    const want = new Set(resolveBrowseCountryParamToCountryKeySlugs(cRaw).map((x) => x.toLowerCase()))
    if (want.size === 0) return false
    const pk = (product.countryKey ?? '').trim().toLowerCase()
    return Boolean(pk && want.has(pk))
  }

  if (hasDbBrowseGeo) {
    if (rRaw && rDbConts.length > 0) {
      const urlCountryMatchesDb =
        Boolean(c) && dbCountryMatchesBrowseCountryParam(dbCountryRaw, cRaw)
      if (!urlCountryMatchesDb) {
        const contOk = rDbConts.includes(dbCont)
        const countryAsTab = rDbConts.includes(dbCountry)
        if (
          !contOk &&
          !countryAsTab &&
          !tagMatchesRegionContinent() &&
          !masterProductContinentMatchesRegion()
        )
          return false
      }
    }
    if (
      cRaw &&
      !dbCountryMatchesBrowseCountryParam(dbCountryRaw, cRaw) &&
      !tagMatchesCountryParam() &&
      !masterProductCountryKeyMatchesUrl()
    )
      return false
    if (
      ctRaw &&
      !dbCityMatchesBrowseCityParam(dbCityRaw, ctRaw) &&
      !tagMatchesCityParam() &&
      !masterProductCityMatchesUrl()
    )
      return false
    return termsMatch()
  }

  return termsMatch()
}

/** 메가메뉴 트리 leaf 활성화 — 태그로 동일 국가·리프(또는 국가 전체 태그) 매칭 */
export function productCountryTagMatchesLeafNode(
  country: OverseasCountryNode,
  leaf: OverseasLeafNode,
  tags?: readonly CountryTagMatchSlice[]
): boolean {
  if (!tags?.length) return false
  const wantCountry = country.countryKey.trim().toLowerCase()
  const leafKey = leaf.nodeKey.trim().toLowerCase()
  for (const t of tags) {
    const ck = (t.countryKey ?? '').trim().toLowerCase()
    if (ck !== wantCountry) continue
    const nk = (t.nodeKey ?? '').trim().toLowerCase()
    if (!nk) return true
    if (nk === leafKey) return true
    const leafTerms = matchTokensForLeaf(country, leaf)
    for (const term of leafTerms) {
      const low = term.trim().toLowerCase()
      if (!low) continue
      if (low === nk || nk.includes(low) || low.includes(nk)) return true
    }
  }
  return false
}

/** 국가 shallow(리프 없이 국가만) — 해당 국가키 태그가 있으면 활성 */
export function productCountryTagMatchesCountryShallowNode(
  country: OverseasCountryNode,
  tags?: readonly CountryTagMatchSlice[]
): boolean {
  if (!tags?.length) return false
  const want = country.countryKey.trim().toLowerCase()
  return tags.some((t) => (t.countryKey ?? '').trim().toLowerCase() === want)
}

/** I-4: 마스터 도시 키·다도시 태그 ↔ 트리 leaf */
export function productCityTagMatchesLeafNode(
  leaf: OverseasLeafNode,
  cityKey: string | null | undefined,
  cityTags?: readonly CityTagMatchSlice[],
): boolean {
  const lk = leaf.nodeKey.trim().toLowerCase()
  const pk = (cityKey ?? '').trim().toLowerCase()
  if (pk && pk === lk) return true
  return cityTags?.some((t) => (t.cityKey ?? '').trim().toLowerCase() === lk) ?? false
}

export type OverseasTreeMatchScope = 'leaf' | 'country' | 'group'

export type MatchProductToOverseasNodeResult = {
  scope: OverseasTreeMatchScope
  groupKey: string
  groupLabel: string
  countryKey?: string
  countryLabel?: string
  leafKey?: string
  leafLabel?: string
  /** 매칭에 사용된 토큰 (가장 긴 term 우선) */
  matchedTerm: string
}

function bestTermInHaystack(haystack: string, terms: string[]): string | null {
  let best: string | null = null
  let bestLen = 0
  for (const t of terms) {
    const trimmed = t.trim()
    if (trimmed.length < 2) continue
    const low = trimmed.toLowerCase()
    if (haystack.includes(low) && trimmed.length > bestLen) {
      best = trimmed
      bestLen = trimmed.length
    }
  }
  return best
}

/**
 * 상품 문자열과 가장 잘 맞는 트리 노드( leaf → country → group )를 역추적.
 * 큐레이션·관리자 툴·로그용. 클라이언트 필터에는 `productMatchesOverseasDestinationTerms` 권장.
 */
export function matchProductToOverseasNode(
  product: OverseasProductMatchInput,
  tree: OverseasRegionGroupNode[] = OVERSEAS_LOCATION_TREE_CLEAN
): MatchProductToOverseasNodeResult | null {
  const haystack = buildOverseasProductMatchHaystack(product)

  let best: MatchProductToOverseasNodeResult | null = null

  for (const group of tree) {
    for (const country of group.countries) {
      for (const leaf of country.children) {
        const term = bestTermInHaystack(haystack, matchTokensForLeaf(country, leaf))
        if (!term) continue
        if (!best || term.length > best.matchedTerm.length) {
          best = {
            scope: 'leaf',
            groupKey: group.groupKey,
            groupLabel: group.groupLabel,
            countryKey: country.countryKey,
            countryLabel: country.countryLabel,
            leafKey: leaf.nodeKey,
            leafLabel: leaf.nodeLabel,
            matchedTerm: term,
          }
        }
      }
    }
  }
  if (best) return best

  for (const group of tree) {
    for (const country of group.countries) {
      const term = bestTermInHaystack(haystack, matchTokensForCountryShallow(country))
      if (!term) continue
      if (!best || term.length > best.matchedTerm.length) {
        best = {
          scope: 'country',
          groupKey: group.groupKey,
          groupLabel: group.groupLabel,
          countryKey: country.countryKey,
          countryLabel: country.countryLabel,
          matchedTerm: term,
        }
      }
    }
  }
  if (best) return best

  for (const group of tree) {
    const term = bestTermInHaystack(haystack, matchTokensForGroupShallow(group))
    if (!term) continue
    if (!best || term.length > best.matchedTerm.length) {
      best = {
        scope: 'group',
        groupKey: group.groupKey,
        groupLabel: group.groupLabel,
        matchedTerm: term,
      }
    }
  }

  return best
}
