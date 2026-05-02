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
  dbCityMatchesBrowseCityParam,
  dbCountryMatchesBrowseCountryParam,
  normalizeBrowseRegionToDbContinent,
} from '@/lib/browse-country-url-resolve'

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
  const rCont = normalizeBrowseRegionToDbContinent(rRaw)
  const rContLower = rCont?.toLowerCase() ?? ''
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

  if (hasDbBrowseGeo) {
    if (rRaw && rContLower) {
      const urlCountryMatchesDb =
        Boolean(c) && dbCountryMatchesBrowseCountryParam(dbCountryRaw, cRaw)
      if (!urlCountryMatchesDb) {
        if (dbCont !== rContLower && dbCountry !== rContLower) return false
      }
    }
    if (cRaw && !dbCountryMatchesBrowseCountryParam(dbCountryRaw, cRaw)) return false
    if (ctRaw && !dbCityMatchesBrowseCityParam(dbCityRaw, ctRaw)) return false
    return termsMatch()
  }

  return termsMatch()
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
