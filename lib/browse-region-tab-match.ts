import { matchProductToOverseasNode, type OverseasProductMatchInput } from '@/lib/match-overseas-product'
import { continentTabIdForMatch } from '@/lib/unified-location-tree'

/**
 * browse `region=japan` 등 메가메뉴 탭만 있을 때 — ProductCountryTag 없이도
 * `matchProductToOverseasNode` + continentTabIdForMatch 로 권역 일치 여부를 판단한다.
 */
export function productMatchesBrowseRegionTab(
  product: OverseasProductMatchInput,
  regionTabId: string,
): boolean {
  const tab = regionTabId.trim()
  if (!tab) return true
  const match = matchProductToOverseasNode(product)
  if (!match) return false
  return continentTabIdForMatch(match.groupKey, match.countryKey) === tab
}
