/**
 * 국내 목적지 트리 ↔ 상품 매칭 (해외 match-overseas-product 와 동일 패턴).
 */
import {
  DOMESTIC_LOCATION_TREE_CLEAN,
  matchTokensForDomesticAreaShallow,
  matchTokensForDomesticGroupShallow,
  matchTokensForDomesticLeaf,
  type DomesticAreaNode,
  type DomesticRegionGroupNode,
} from '@/lib/domestic-location-tree'

export type DomesticProductMatchInput = {
  title: string
  originSource: string
  primaryDestination?: string | null
  destinationRaw?: string | null
  destination?: string | null
  primaryRegion?: string | null
}

export function buildDomesticProductMatchHaystack(p: DomesticProductMatchInput): string {
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

export function productMatchesDomesticDestinationTerms(
  product: DomesticProductMatchInput,
  terms: string[]
): boolean {
  if (terms.length === 0) return true
  const haystack = buildDomesticProductMatchHaystack(product)
  return terms.some((t) => {
    const k = t.trim().toLowerCase()
    return k.length > 0 && haystack.includes(k)
  })
}

/** 관리자 `themeTags`(쉼표 구분)와 테마 칩 토큰 부분일치 */
export function productThemeTagsMatchTerms(themeTags: string | null | undefined, terms: string[]): boolean {
  if (!terms.length) return false
  const raw = themeTags?.trim()
  if (!raw) return false
  const haystack = raw.toLowerCase()
  return terms.some((t) => {
    const k = t.trim().toLowerCase()
    return k.length > 0 && haystack.includes(k)
  })
}

export type DomesticTreeMatchScope = 'leaf' | 'area' | 'group'

export type MatchProductToDomesticNodeResult = {
  scope: DomesticTreeMatchScope
  groupKey: string
  groupLabel: string
  areaKey?: string
  areaLabel?: string
  leafKey?: string
  leafLabel?: string
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

export function matchProductToDomesticNode(
  product: DomesticProductMatchInput,
  tree: DomesticRegionGroupNode[] = DOMESTIC_LOCATION_TREE_CLEAN
): MatchProductToDomesticNodeResult | null {
  const haystack = buildDomesticProductMatchHaystack(product)
  let best: MatchProductToDomesticNodeResult | null = null

  for (const group of tree) {
    for (const area of group.areas) {
      for (const leaf of area.children) {
        const term = bestTermInHaystack(haystack, matchTokensForDomesticLeaf(area, leaf))
        if (!term) continue
        if (!best || term.length > best.matchedTerm.length) {
          best = {
            scope: 'leaf',
            groupKey: group.groupKey,
            groupLabel: group.groupLabel,
            areaKey: area.areaKey,
            areaLabel: area.areaLabel,
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
    for (const area of group.areas) {
      const term = bestTermInHaystack(haystack, matchTokensForDomesticAreaShallow(area))
      if (!term) continue
      if (!best || term.length > best.matchedTerm.length) {
        best = {
          scope: 'area',
          groupKey: group.groupKey,
          groupLabel: group.groupLabel,
          areaKey: area.areaKey,
          areaLabel: area.areaLabel,
          matchedTerm: term,
        }
      }
    }
  }
  if (best) return best

  for (const group of tree) {
    const term = bestTermInHaystack(haystack, matchTokensForDomesticGroupShallow(group))
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
