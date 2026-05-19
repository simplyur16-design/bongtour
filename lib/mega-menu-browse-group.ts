/**
 * 메가메뉴 열(현·도·미서부 등) → browse `menuGroup` 쿼리 및 Prisma city/country 키.
 */
import { resolveBrowseCityKeysForFilter, resolveBrowseCountryParamToCountryKeySlugs } from '@/lib/browse-country-url-resolve'
import { countrySlugFromLabel, citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import { MEGA_MENU_TAB_DEFINITIONS, type MegaMenuCountryGroupDef } from '@/lib/mega-menu-regions.data'

export function megaMenuGroupSlugFromLabel(countryLabel: string): string {
  return countrySlugFromLabel(countryLabel)
}

export function findMegaMenuGroup(
  regionId: string,
  menuGroupSlug: string,
): MegaMenuCountryGroupDef | null {
  const tab = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === regionId)
  if (!tab) return null
  const norm = menuGroupSlug.trim().toLowerCase()
  return tab.groups.find((g) => countrySlugFromLabel(g.countryLabel) === norm) ?? null
}

/** 메가메뉴 열 라벨 → browse `menuGroup` (일본·중국 현·도, 미서부, 스포츠 테마 등) */
export function appendMenuGroupParam(params: URLSearchParams, groupCountryLabel: string): void {
  const label = groupCountryLabel.trim()
  if (!label) return
  params.set('menuGroup', countrySlugFromLabel(label))
}

/** 그룹 내 도시 leaf → 마스터 cityKey (LC-only 그룹은 빈 배열) */
export function resolveMegaMenuGroupCityKeys(regionId: string, menuGroupSlug: string): string[] {
  const g = findMegaMenuGroup(regionId, menuGroupSlug)
  if (!g) return []
  const keys = new Set<string>()
  for (const leaf of g.cities) {
    if (leaf.kind !== 'city') continue
    const slug = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
    for (const k of resolveBrowseCityKeysForFilter(slug)) keys.add(k)
  }
  return [...keys]
}

/** 도시 leaf가 없는 그룹(알래스카·홍콩 LC-only 등) — countryKey 슬러그 */
export function resolveMegaMenuGroupCountryKeySlugs(regionId: string, menuGroupSlug: string): string[] {
  const cityKeys = resolveMegaMenuGroupCityKeys(regionId, menuGroupSlug)
  if (cityKeys.length > 0) return []
  const g = findMegaMenuGroup(regionId, menuGroupSlug)
  if (!g) return []
  return resolveBrowseCountryParamToCountryKeySlugs(countrySlugFromLabel(g.countryLabel))
}
