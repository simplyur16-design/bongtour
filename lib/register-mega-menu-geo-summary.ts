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
import {
  EUROPE_EASTERN_MENU_GROUP_SLUG,
  EUROPE_NORTHERN_MENU_GROUP_SLUG,
  EUROPE_WESTERN_MENU_GROUP_SLUG,
  findMegaMenuGroup,
  resolveMegaMenuGroupCountryKeySlugs,
} from '@/lib/mega-menu-browse-group'
import { resolveBrowseCountryParamToCountryKeySlugs } from '@/lib/browse-country-url-resolve'

/** 동유럽 browse — 체코·헝가리 등 eastern 태그가 있으면 오스트리아 동반 패키지도 동유럽 열 */
const EUROPE_EASTERN_SIGNAL_COUNTRY_KEYS = new Set([
  'czech',
  'hungary',
  'poland',
  'croatia',
  'slovenia',
])

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
 * REGRESSION-FREEZE[register-mega-menu-auto-classify]: 태그만으로 browse 가능하면 pending 금지 — manifest
 * REGRESSION-FREEZE[register-confirm-mega-menu-image-guard]: confirm 통합 vitest·verify — manifest
 * 운영·어드민 confirm 응답·로그용 (browse 노출 전 검수).
 */
export function inferMegaMenuSubgroupFromRegisterTags(
  regionId: string,
  countryTagKeys: readonly string[],
  cityKeys: readonly string[],
): string | null {
  const tab = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === regionId)
  if (!tab?.groups.length) return null

  for (const ck of cityKeys) {
    const placement = megaMenuPlacementForCityKey(ck)
    if (placement?.regionId !== regionId) continue
    const group = tab.groups.find(
      (g) => countrySlugFromLabel(g.countryLabel) === placement.menuGroupSlug,
    )
    if (group) return megaMenuGroupToDisplayLabel(regionId, group.countryLabel)
  }

  const countrySet = new Set(countryTagKeys.map((k) => k.trim()).filter(Boolean))
  if (countrySet.size === 0) return null

  if (regionId === 'europe-me') {
    if ([...countrySet].some((k) => EUROPE_EASTERN_SIGNAL_COUNTRY_KEYS.has(k))) {
      const g = findMegaMenuGroup(regionId, EUROPE_EASTERN_MENU_GROUP_SLUG)
      if (g) return megaMenuGroupToDisplayLabel(regionId, g.countryLabel)
    }
    const europeSlugs = [
      EUROPE_NORTHERN_MENU_GROUP_SLUG,
      countrySlugFromLabel('스페인/포르투갈'),
      EUROPE_WESTERN_MENU_GROUP_SLUG,
    ]
    for (const slug of europeSlugs) {
      const groupCountries = resolveMegaMenuGroupCountryKeySlugs(regionId, slug)
      if (groupCountries.length > 0 && groupCountries.some((k) => countrySet.has(k))) {
        const g = findMegaMenuGroup(regionId, slug)
        if (g) return megaMenuGroupToDisplayLabel(regionId, g.countryLabel)
      }
    }
    return null
  }

  for (const group of tab.groups) {
    const mgSlug = countrySlugFromLabel(group.countryLabel)
    let groupCountries = resolveMegaMenuGroupCountryKeySlugs(regionId, mgSlug)
    if (groupCountries.length === 0) {
      groupCountries = resolveBrowseCountryParamToCountryKeySlugs(mgSlug)
    }
    if (groupCountries.length > 0 && groupCountries.some((k) => countrySet.has(k))) {
      return megaMenuGroupToDisplayLabel(regionId, group.countryLabel)
    }
  }

  return null
}

export function megaMenuSummaryNeedsOperatorReview(
  summary: RegisterMegaMenuGeoSummary,
  opts?: { countryTagKeys?: readonly string[] },
): boolean {
  if (!summary.countryKey) return true
  if (!summary.browseRegionTab) return true

  const countryTagCount =
    opts?.countryTagKeys?.map((k) => k.trim()).filter(Boolean).length ??
    (summary.countryKey ? 1 : 0)
  const cityTagCount = summary.cityKeys.length

  if (isMegaMenuRegionCityGroupTabId(summary.browseRegionTab)) {
    /** browse Prisma where는 ProductCountryTag/ProductCityTag만 사용 — subgroup 문자열은 UI 그룹 헤더용 */
    if (countryTagCount >= 1 || cityTagCount >= 1) return false
    return true
  }

  return false
}

export function buildRegisterMegaMenuGeoSummary(input: {
  geo: ProductLocationKeyPrismaFields
  cityKeys: readonly string[]
  countryTagKeys?: readonly string[]
  /** geo.countryKey null일 때 cityTag·countryTag에서 보강한 표시용 countryKey */
  countryKeyOverride?: string | null
  tagOpts: {
    title: string
    primaryDestination: string | null
    destinationRaw: string | null
    scheduleHaystack?: string | null
  }
}): RegisterMegaMenuGeoSummary {
  const warnings: string[] = []
  const countryKey = input.countryKeyOverride?.trim() || input.geo.countryKey?.trim() || null
  if (!countryKey) warnings.push('countryKey 없음 — 메가메뉴 국가 매핑 불가')

  const destinationHaystack = [
    input.tagOpts.title,
    input.tagOpts.primaryDestination,
    input.tagOpts.destinationRaw,
    input.tagOpts.scheduleHaystack,
  ]
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
      if (!subgroupLabel || subgroupLabel === '기타') {
        const tagCountryKeys = countryTagKeys.length
          ? countryTagKeys
          : countryKey
            ? [countryKey]
            : []
        const inferred = inferMegaMenuSubgroupFromRegisterTags(
          browseRegionTab,
          tagCountryKeys,
          input.cityKeys,
        )
        if (inferred && inferred !== '기타') subgroupLabel = inferred
      }
      if (!subgroupLabel || subgroupLabel === '기타') {
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
