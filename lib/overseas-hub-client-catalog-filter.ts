import { sportsThemeTagForBrowseRegion } from '@/lib/browse-master-geo-continents'
import type { ResultItem } from '@/components/products/ProductResultsList'
import { countrySlugFromLabel, koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import { findMegaMenuGroup } from '@/lib/mega-menu-browse-group'
import { getOverseasHubCatalogForMegaRegionTab } from '@/lib/overseas-hub-catalog-region-index'
import { filterCatalogByMegaRegionTab } from '@/lib/overseas-hub-mega-region-bucket'
import {
  isMegaMenuRegionCityGroupTabId,
  megaMenuGroupToDisplayLabel,
  resolveOverseasHubMegaSubgroupDisplayLabel,
} from '@/lib/overseas-mega-region-city-group'
import { parseBrowseQuery } from '@/lib/products-browse-query'

function itemMatchesBrowseCountryParam(item: ResultItem, countryParam: string): boolean {
  const slug = countryParam.trim().toLowerCase()
  if (!slug) return false
  const stored = (item.browseCountry ?? '').trim()
  if (!stored) return false
  if (stored.toLowerCase() === slug) return true
  const krFromSlug = koreanCountryLabelFromBrowseSlug(slug)
  if (krFromSlug && stored === krFromSlug) return true
  return countrySlugFromLabel(stored).toLowerCase() === slug
}

function filterItemsByCityNeedle(items: ResultItem[], cityNeedle: string): ResultItem[] {
  const needle = cityNeedle.trim().toLowerCase()
  if (!needle) return items
  return items.filter((it) => {
    const hay = [it.primaryDestination, it.primaryRegion, it.title, it.countryRowLabel]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(needle)
  })
}

/** 메가메뉴 열(홋카이도·간사이 등) — `menuGroup` 쿼리로 하위분류만 좁힘 */
function filterOverseasHubCatalogByMenuGroup(
  items: ResultItem[],
  regionId: string,
  menuGroupSlug: string,
): ResultItem[] | null {
  const mg = menuGroupSlug.trim().toLowerCase()
  if (!mg || !isMegaMenuRegionCityGroupTabId(regionId)) return null
  const group = findMegaMenuGroup(regionId, mg)
  if (!group) return null

  const targetLabel = megaMenuGroupToDisplayLabel(regionId, group.countryLabel)
  const regionPool = filterCatalogByMegaRegionTab(items, regionId)
  return regionPool.filter(
    (it) => resolveOverseasHubMegaSubgroupDisplayLabel(it, regionId) === targetLabel,
  )
}

/**
 * 해외 허브 — 전량 카탈로그(1회 fetch)를 URL `region`/`country`/`city`/`menuGroup`로 클라이언트 필터.
 * 메가메뉴 상위분류 클릭 시 API 재요청 없음.
 */
export function filterOverseasHubCatalogByUrl(
  items: ResultItem[],
  searchParams: URLSearchParams,
): ResultItem[] {
  const q = parseBrowseQuery(searchParams)
  const region = (q.region ?? '').trim()
  const country = (q.country ?? '').trim()
  const city = (q.city ?? '').trim()
  const destination = (searchParams.get('destination') ?? '').trim()
  const sportsThemeParam = (q.sportsTheme ?? '').trim()
  const menuGroup = (searchParams.get('menuGroup') ?? '').trim()

  const hasGeo =
    Boolean(region) ||
    Boolean(country) ||
    Boolean(city) ||
    Boolean(destination) ||
    Boolean(sportsThemeParam) ||
    Boolean(menuGroup)
  if (!hasGeo) return items

  if (region === 'sports_theme' || sportsThemeParam) {
    const tag = sportsThemeTagForBrowseRegion(region, sportsThemeParam)
    if (!tag) return items.filter((it) => (it.sportsThemeTags?.length ?? 0) > 0)
    return items.filter((it) => it.sportsThemeTags?.includes(tag))
  }

  if (menuGroup && region) {
    const byMenuGroup = filterOverseasHubCatalogByMenuGroup(items, region, menuGroup)
    if (byMenuGroup) {
      const cityNeedle = city || destination
      return cityNeedle ? filterItemsByCityNeedle(byMenuGroup, cityNeedle) : byMenuGroup
    }
  }

  if (
    region &&
    isMegaMenuRegionCityGroupTabId(region) &&
    !country &&
    !city &&
    !destination &&
    !menuGroup
  ) {
    const indexed = getOverseasHubCatalogForMegaRegionTab(region)
    if (indexed) return indexed

    return filterCatalogByMegaRegionTab(items, region)
  }

  if (country) {
    return items.filter((it) => itemMatchesBrowseCountryParam(it, country))
  }

  const cityNeedle = city || destination
  if (cityNeedle) {
    return filterItemsByCityNeedle(items, cityNeedle)
  }

  return items
}
