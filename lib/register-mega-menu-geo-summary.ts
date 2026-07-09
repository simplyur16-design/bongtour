import { matchProductToOverseasNode, type OverseasProductMatchInput } from '@/lib/match-overseas-product'
import {
  isMegaMenuRegionCityGroupTabId,
  megaMenuGroupToDisplayLabel,
  resolveOverseasMegaMenuSubgroupLabelForBrowse,
} from '@/lib/overseas-mega-region-city-group'
import { resolveOverseasCountryRowLabelForBrowse } from '@/lib/overseas-display-buckets'
import type { ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'
import { continentTabIdForMatch } from '@/lib/unified-location-tree'
import { megaMenuPlacementForCityKey } from '@/lib/mega-menu-city-group-coherence'
import { countrySlugFromLabel } from '@/lib/location-url-slugs'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'

export type RegisterMegaMenuGeoSummary = {
  /** browse `region=` 탭 id (japan, southeast-asia, …) */
  browseRegionTab: string | null
  /** 메가메뉴 중분류(열) 라벨 — 홋카이도, 간사이, 베트남 등 */
  subgroupLabel: string | null
  countryKey: string | null
  cityKeys: string[]
  warnings: string[]
}

/**
 * 등록 직후 geo·도시 태그 기준 메가메뉴 대·중·소분류 요약.
 * REGRESSION-FREEZE[mega-menu-product-alignment]: cityKey placement 우선 — manifest
 * 운영·어드민 confirm 응답·로그용 (browse 노출 전 검수).
 */
export function megaMenuSummaryNeedsOperatorReview(summary: RegisterMegaMenuGeoSummary): boolean {
  if (!summary.countryKey) return true
  if (!summary.browseRegionTab) return true
  if (
    summary.browseRegionTab &&
    isMegaMenuRegionCityGroupTabId(summary.browseRegionTab) &&
    !summary.subgroupLabel
  ) {
    return true
  }
  return false
}

export function buildRegisterMegaMenuGeoSummary(input: {
  geo: ProductLocationKeyPrismaFields
  cityKeys: readonly string[]
  countryTagKeys?: readonly string[]
  tagOpts: {
    title: string
    primaryDestination: string | null
    destinationRaw: string | null
    scheduleHaystack?: string | null
  }
}): RegisterMegaMenuGeoSummary {
  const warnings: string[] = []
  const countryKey = input.geo.countryKey?.trim() || null
  if (!countryKey) warnings.push('countryKey 없음 — 메가메뉴 국가 매핑 불가')

  const destinationHaystack = [input.tagOpts.destinationRaw, input.tagOpts.scheduleHaystack]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .join(' ')

  const countryTagKeys = input.countryTagKeys?.length
    ? [...new Set(input.countryTagKeys.map((k) => k.trim()).filter(Boolean))]
    : []

  const matchInput: OverseasProductMatchInput = {
    title: input.tagOpts.title,
    originSource: '',
    primaryDestination: input.tagOpts.primaryDestination,
    destinationRaw: destinationHaystack || input.tagOpts.destinationRaw,
    countryKey,
    cityKey: input.geo.cityKey ?? null,
    nodeKey: input.geo.nodeKey ?? null,
    cityTags: input.cityKeys.map((cityKey) => ({ cityKey })),
    ...(countryTagKeys.length > 0
      ? { countryTags: countryTagKeys.map((ck) => ({ countryKey: ck, nodeKey: null })) }
      : {}),
  }

  const match = matchProductToOverseasNode(matchInput)

  const primaryCityKey =
    input.cityKeys.find(Boolean)?.trim() ||
    input.geo.cityKey?.trim() ||
    null
  const cityPlacement = primaryCityKey ? megaMenuPlacementForCityKey(primaryCityKey) : null

  let browseRegionTab: string | null = null
  let subgroupLabel: string | null = null

  if (cityPlacement) {
    browseRegionTab = cityPlacement.regionId
    if (cityPlacement.regionId !== 'europe-me') {
      const tab = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === cityPlacement.regionId)
      const group = tab?.groups.find(
        (g) => countrySlugFromLabel(g.countryLabel) === cityPlacement.menuGroupSlug,
      )
      subgroupLabel = group
        ? megaMenuGroupToDisplayLabel(cityPlacement.regionId, group.countryLabel)
        : null
    }
  }

  if (!browseRegionTab && match) {
    browseRegionTab = continentTabIdForMatch(match.groupKey, match.countryKey)
  }
  if (!browseRegionTab) warnings.push('해외 목적지 트리 매칭 실패 — 권역 탭 분류 불명')

  const countryRowLabel = resolveOverseasCountryRowLabelForBrowse(matchInput, match)
  if (browseRegionTab && isMegaMenuRegionCityGroupTabId(browseRegionTab)) {
    const needsBrowseSubgroup =
      browseRegionTab === 'europe-me' || !subgroupLabel
    if (needsBrowseSubgroup) {
      subgroupLabel =
        resolveOverseasMegaMenuSubgroupLabelForBrowse(
          matchInput,
          match,
          browseRegionTab,
          countryRowLabel,
        ) ?? subgroupLabel
      if (!subgroupLabel) {
        warnings.push(`메가메뉴 중분류(열) 미매칭 — region=${browseRegionTab}`)
      }
    }
  }

  if (input.cityKeys.length === 0) {
    warnings.push('ProductCityTag 없음 — 도시·열 browse 필터 약함')
  }

  return {
    browseRegionTab,
    subgroupLabel,
    countryKey,
    cityKeys: [...input.cityKeys],
    warnings,
  }
}
