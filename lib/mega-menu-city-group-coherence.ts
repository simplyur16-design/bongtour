/**
 * 메가메뉴 도시 태그 정합 — 동일 상위탭(region) 안 다열(간사이·홋카이도)은 유지,
 * 타 region(괌 vs 유럽 등)만 primary region으로 clamp.
 */
// REGRESSION-FREEZE[mega-menu-same-region-multi-column-city-tags]: 동일 region 다열 cityKey 유지 — manifest
import { resolveBrowseCityKeysForFilter } from '@/lib/browse-country-url-resolve'
import { countrySlugFromLabel, citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'

export type MegaMenuCityPlacement = {
  regionId: string
  menuGroupSlug: string
}

let cityPlacementCache: Map<string, MegaMenuCityPlacement> | null = null

function buildCityPlacementIndex(): Map<string, MegaMenuCityPlacement> {
  const map = new Map<string, MegaMenuCityPlacement>()
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture || !tab.groups.length) continue
    for (const group of tab.groups) {
      const menuGroupSlug = countrySlugFromLabel(group.countryLabel)
      for (const leaf of group.cities) {
        if (leaf.kind !== 'city' && leaf.kind !== 'country') continue
        const slug = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
        for (const ck of resolveBrowseCityKeysForFilter(slug)) {
          map.set(ck, { regionId: tab.id, menuGroupSlug })
        }
      }
    }
  }
  return map
}

function cityPlacementIndex(): Map<string, MegaMenuCityPlacement> {
  if (!cityPlacementCache) cityPlacementCache = buildCityPlacementIndex()
  return cityPlacementCache
}

export function resetMegaMenuCityPlacementCache(): void {
  cityPlacementCache = null
}

export function megaMenuPlacementForCityKey(cityKey: string | null | undefined): MegaMenuCityPlacement | null {
  const k = (cityKey ?? '').trim()
  if (!k) return null
  return cityPlacementIndex().get(k) ?? null
}

/**
 * primary 도시와 같은 mega-menu region 의 cityKey는 열(menuGroup)이 달라도 유지.
 * 다른 region 키만 제거(다도시·클러스터 후보는 호출 전에 모두 포함된 상태).
 */
export function filterCityKeysToCoherentMegaMenuGroup(
  primaryCityKey: string | null | undefined,
  cityKeys: string[],
): string[] {
  const keys = [...new Set(cityKeys.map((k) => k.trim()).filter(Boolean))]
  if (keys.length <= 1) return keys

  const primary = (primaryCityKey ?? '').trim()
  const primaryPlace = primary ? megaMenuPlacementForCityKey(primary) : null
  if (!primaryPlace) return keys

  const sameRegion = keys.filter((k) => {
    const p = megaMenuPlacementForCityKey(k)
    return p?.regionId === primaryPlace.regionId
  })
  if (sameRegion.includes(primary)) return sameRegion

  return primary && keys.includes(primary) ? [primary] : keys
}
