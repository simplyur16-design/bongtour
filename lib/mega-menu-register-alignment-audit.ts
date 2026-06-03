/**
 * 메가메뉴 도시 leaf ↔ browse 슬러그 ↔ 해외 트리 ↔ matchProductToOverseasNode 정합 (DB 불필요).
 */
import { resolveBrowseCityKeysForFilter } from '@/lib/browse-country-url-resolve'
import { buildMegaMenuCityHaystackIndex } from '@/lib/mega-menu-city-haystack-terms'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import { citySlugFromTermsAndLabel, countrySlugFromLabel } from '@/lib/location-url-slugs'
import { OVERSEAS_LOCATION_TREE_DATA } from '@/lib/overseas-location-tree.data'

export type MegaMenuCityLeafAlignmentRow = {
  tabId: string
  groupLabel: string
  leafLabel: string
  countrySlug: string
  citySlug: string
  browseCityKeys: string[]
  treeHasLeaf: boolean
  ssotHaystackHasKey: boolean
  matchLeafKey: string | null
  /** browse·ProductCityTag에 필요 — 실패 시 exit 1 */
  blockingIssues: string[]
  /** 트리 nodeKey·matchProduct 별칭 차이 — 리포트만 */
  warnings: string[]
}

export type MegaMenuRegisterAlignmentReport = {
  cityLeavesChecked: number
  ok: number
  blockingCount: number
  warningOnlyCount: number
  rows: MegaMenuCityLeafAlignmentRow[]
}

const TREE_LEAF_NODE_KEYS = new Set<string>()
for (const group of OVERSEAS_LOCATION_TREE_DATA) {
  for (const country of group.countries) {
    for (const leaf of country.children) {
      TREE_LEAF_NODE_KEYS.add(leaf.nodeKey)
    }
  }
}

function treeHasAnyLeafKey(keys: string[]): boolean {
  return keys.some((k) => TREE_LEAF_NODE_KEYS.has(k))
}

export function auditMegaMenuCityLeafRegisterAlignment(): MegaMenuRegisterAlignmentReport {
  const ssot = buildMegaMenuCityHaystackIndex()
  const rows: MegaMenuCityLeafAlignmentRow[] = []

  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    for (const group of tab.groups) {
      const groupCountrySlug = countrySlugFromLabel(group.countryLabel) ?? ''
      for (const leaf of group.cities) {
        if (leaf.kind !== 'city') continue
        const browseCountryLabel = leaf.browseCountryLabel ?? group.headerBrowseCountryLabel ?? group.countryLabel
        const countrySlug = countrySlugFromLabel(browseCountryLabel) ?? groupCountrySlug
        const citySlug = citySlugFromTermsAndLabel(leaf.label, leaf.terms) ?? ''
        const browseCityKeys = resolveBrowseCityKeysForFilter(citySlug)
        const treeHasLeaf = treeHasAnyLeafKey(browseCityKeys)
        const ssotHaystackHasKey = browseCityKeys.some((k) => ssot.cityKeys.has(k))
        const matched = matchProductToOverseasNode({
          title: `${leaf.label} 패키지`,
          originSource: 'ybtour',
          primaryDestination: leaf.label,
        })
        const blockingIssues: string[] = []
        const warnings: string[] = []
        if (!citySlug) blockingIssues.push('missing_city_slug')
        if (browseCityKeys.length === 0) blockingIssues.push('browse_city_keys_empty')
        if (!ssotHaystackHasKey) blockingIssues.push('ssot_haystack_missing_key')
        if (!treeHasLeaf) warnings.push('tree_leaf_missing')
        if (!matched?.leafKey) warnings.push('match_product_null')
        else if (browseCityKeys.length > 0 && !browseCityKeys.includes(matched.leafKey)) {
          warnings.push(`match_leaf_${matched.leafKey}_not_in_browse_keys`)
        }

        if (blockingIssues.length === 0 && warnings.length === 0) continue

        rows.push({
          tabId: tab.id,
          groupLabel: group.countryLabel,
          leafLabel: leaf.label,
          countrySlug,
          citySlug,
          browseCityKeys,
          treeHasLeaf,
          ssotHaystackHasKey,
          matchLeafKey: matched?.leafKey ?? null,
          blockingIssues,
          warnings,
        })
      }
    }
  }

  const blocking = rows.filter((r) => r.blockingIssues.length > 0)
  const warnOnly = rows.filter((r) => r.blockingIssues.length === 0 && r.warnings.length > 0)
  const totalLeaves = MEGA_MENU_TAB_DEFINITIONS.filter((t) => !t.localDeparture).reduce(
    (n, t) => n + t.groups.reduce((g, gr) => g + gr.cities.filter((c) => c.kind === 'city').length, 0),
    0,
  )
  return {
    cityLeavesChecked: totalLeaves,
    ok: totalLeaves - blocking.length,
    blockingCount: blocking.length,
    warningOnlyCount: warnOnly.length,
    rows: [...blocking, ...warnOnly.slice(0, 40)],
  }
}
