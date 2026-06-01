/**
 * 메가메뉴 열(간사이·홋카이도 등) 단위 — 단일 목적지 상품에 타 열 도시 태그가 섞이지 않게 한다.
 */
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
        if (leaf.kind !== 'city') continue
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

export function megaMenuPlacementForCityKey(cityKey: string | null | undefined): MegaMenuCityPlacement | null {
  const k = (cityKey ?? '').trim()
  if (!k) return null
  return cityPlacementIndex().get(k) ?? null
}

/**
 * primary 도시가 속한 메가메뉴 열과 다른 열의 도시 태그는 제거(다도시·클러스터는 호출 전에 후보에 모두 포함된 상태).
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

  const sameGroup = keys.filter((k) => {
    const p = megaMenuPlacementForCityKey(k)
    return p?.regionId === primaryPlace.regionId && p.menuGroupSlug === primaryPlace.menuGroupSlug
  })

  if (sameGroup.length === 0) return keys
  if (sameGroup.includes(primary)) return sameGroup
  return keys
}
