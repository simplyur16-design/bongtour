/**
 * 메가메뉴 도시 태그 정합 — 동일 상위탭(region) 안 다열(간사이·홋카이도)은 유지,
 * 타 region(괌 vs 유럽 등)만 primary region으로 clamp.
 */
// REGRESSION-FREEZE[mega-menu-same-region-multi-column-city-tags]: 동일 region 다열 cityKey 유지 — manifest
import { resolveBrowseCityKeysForFilter } from '@/lib/browse-country-url-resolve'
import { termAppearsInHaystack } from '@/lib/geo-haystack-match'
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

/** 도시 leaf 의 표시명·cityKey 만. 다른 도시 별칭(샤먼 잎의 천저우 등)은 근거로 쓰지 않는다. */
function cityOwnNames(cityKey: string): string[] {
  const names = new Set<string>([cityKey])
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        if (leaf.kind !== 'city') continue
        const slug = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
        const owns =
          slug === cityKey ||
          leaf.terms.some((t) => t.trim().toLowerCase() === cityKey)
        if (owns) names.add(leaf.label)
      }
    }
  }
  return [...names]
}

/**
 * primary 와 다른 메가메뉴 열의 도시는 제목·일정에 그 도시 이름이 있을 때만 남긴다.
 * 같은 열(간사이·홋카이도·하와이)은 그대로 둔다.
 * REGRESSION-FREEZE[process13-browse-fixes]: cross-group city tag needs own name — manifest
 */
export function filterCrossGroupCityKeysUnlessNamed(
  primaryCityKey: string | null | undefined,
  cityKeys: string[],
  haystack: string,
): string[] {
  const keys = [...new Set(cityKeys.map((k) => k.trim()).filter(Boolean))]
  const primary = (primaryCityKey ?? '').trim()
  const primaryPlace = primary ? megaMenuPlacementForCityKey(primary) : null
  const hay = haystack.trim()
  if (!primaryPlace || !hay) return keys
  return keys.filter((k) => {
    if (k === primary) return true
    const place = megaMenuPlacementForCityKey(k)
    if (place && place.regionId === primaryPlace.regionId && place.menuGroupSlug === primaryPlace.menuGroupSlug) {
      return true
    }
    return cityOwnNames(k).some((name) => termAppearsInHaystack(name, hay))
  })
}
