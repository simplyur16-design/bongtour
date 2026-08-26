import { resolveBrowseCountryParamToCountryKeySlugs } from '@/lib/browse-country-url-resolve'
import { sportsThemeTagForBrowseRegion } from '@/lib/browse-master-geo-continents'
import type { ResultItem } from '@/components/products/ProductResultsList'
import { countrySlugFromLabel, koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import {
  findMegaMenuGroup,
  resolveMegaMenuEuropeMenuGroupExclusiveFilter,
  resolveMegaMenuGroupCityKeys,
  resolveMegaMenuGroupCountryKeySlugs,
} from '@/lib/mega-menu-browse-group'
import {
  productMatchesBrowseUrlGeo,
  type BrowseUrlGeo,
  type OverseasProductMatchInput,
} from '@/lib/match-overseas-product'
import { getOverseasHubCatalogForMegaRegionTab } from '@/lib/overseas-hub-catalog-region-index'
import { filterCatalogByMegaRegionTab } from '@/lib/overseas-hub-mega-region-bucket'
import { isMegaMenuRegionCityGroupTabId } from '@/lib/overseas-mega-region-city-group'
import { parseBrowseQuery } from '@/lib/products-browse-query'
import { isAirHotelProduct, parseAirHotelBrowseTypeParam } from '@/lib/air-hotel-product-ssot'

// REGRESSION-FREEZE[overseas-hub-geo-tag-filter]: hub client filter uses ProductCityTag — manifest
// REGRESSION-FREEZE[mega-menu-mid-leaf-tag-filter]: mid=group tags first, leaf=city narrow — manifest
// REGRESSION-FREEZE[overseas-hub-package-fit-split]: type=travel|air-hotel 패키지/자유여행 — manifest

export type OverseasHubTravelType = 'all' | 'package' | 'free'

export function parseOverseasHubTravelType(searchParams: URLSearchParams): OverseasHubTravelType {
  const travelType = (searchParams.get('travelType') ?? '').trim().toLowerCase()
  if (travelType === 'package' || travelType === 'free' || travelType === 'all') return travelType
  const fromType = parseAirHotelBrowseTypeParam(searchParams.get('type'))
  if (fromType === 'air-hotel') return 'free'
  if (fromType === 'travel') return 'package'
  return 'all'
}

export function filterOverseasHubCatalogByTravelType(
  items: ResultItem[],
  travelType: OverseasHubTravelType,
): ResultItem[] {
  if (travelType === 'all') return items
  if (travelType === 'free') {
    return items.filter((it) => isAirHotelProduct({ listingKind: it.listingKind, productType: it.productType }))
  }
  return items.filter((it) => !isAirHotelProduct({ listingKind: it.listingKind, productType: it.productType }))
}

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

function resultItemToGeoMatchInput(item: ResultItem): OverseasProductMatchInput {
  return {
    title: item.title,
    originSource: item.originSource,
    primaryDestination: item.primaryDestination,
    primaryRegion: item.primaryRegion,
    countryTags: item.countryTags?.map((t) => ({
      countryKey: t.countryKey,
      nodeKey: t.nodeKey ?? null,
    })),
    cityTags: item.cityTags,
  }
}

function buildBrowseUrlGeoFromParams(
  region: string,
  country: string,
  city: string,
): BrowseUrlGeo {
  const keys = new Set<string>()
  for (const k of resolveBrowseCountryParamToCountryKeySlugs(country || region)) keys.add(k)
  const countryLower = country.trim().toLowerCase()
  const regionLower = region.trim().toLowerCase()
  if (countryLower === 'japan' || countryLower === '일본' || regionLower === 'japan') keys.add('jp')
  return {
    region: region || null,
    country: country || null,
    city: city || null,
    regionCountryKeys: [...keys],
  }
}

function filterItemsByBrowseUrlGeo(items: ResultItem[], geo: BrowseUrlGeo): ResultItem[] | null {
  const hasTags = items.some(
    (it) => (it.cityTags?.length ?? 0) > 0 || (it.countryTags?.length ?? 0) > 0,
  )
  if (!hasTags) return null
  return items.filter((it) => productMatchesBrowseUrlGeo(resultItemToGeoMatchInput(it), geo))
}

function filterItemsByMenuGroupCityKeys(
  items: ResultItem[],
  regionId: string,
  menuGroupSlug: string,
): ResultItem[] {
  const keys = new Set(resolveMegaMenuGroupCityKeys(regionId, menuGroupSlug).map((k) => k.toLowerCase()))
  if (keys.size === 0) return []
  // REGRESSION-FREEZE[overseas-hub-geo-tag-filter]: hub mid accepts countryTags.nodeKey — manifest
  return items.filter((it) => {
    if ((it.cityTags ?? []).some((t) => keys.has((t.cityKey ?? '').trim().toLowerCase()))) return true
    return (it.countryTags ?? []).some((t) => keys.has((t.nodeKey ?? '').trim().toLowerCase()))
  })
}

function filterItemsByMenuGroupCountryKeys(
  items: ResultItem[],
  include: string[],
  exclude: string[] = [],
): ResultItem[] {
  const includeSet = new Set(include.map((k) => k.trim().toLowerCase()).filter(Boolean))
  const excludeSet = new Set(exclude.map((k) => k.trim().toLowerCase()).filter(Boolean))
  if (includeSet.size === 0) return []
  return items.filter((it) => {
    const keys = (it.countryTags ?? [])
      .map((t) => (t.countryKey ?? '').trim().toLowerCase())
      .filter(Boolean)
    if (!keys.some((k) => includeSet.has(k))) return false
    if (excludeSet.size > 0 && keys.some((k) => excludeSet.has(k))) return false
    return true
  })
}

/**
 * 메가메뉴 중분류 — cityTags ∩ group cityKeys 우선.
 * LC/국가 leaf·유럽 권역은 countryTags(서버 exclusive와 동일)로 좁힘. 전량 반환 금지.
 */
function filterOverseasHubCatalogByMenuGroup(
  items: ResultItem[],
  regionId: string,
  menuGroupSlug: string,
): ResultItem[] | null {
  const mg = menuGroupSlug.trim().toLowerCase()
  if (!mg || !isMegaMenuRegionCityGroupTabId(regionId)) return null
  const group = findMegaMenuGroup(regionId, mg)
  if (!group) return null

  const regionPool = filterCatalogByMegaRegionTab(items, regionId)
  // REGRESSION-FREEZE[overseas-hub-geo-tag-filter]: bucket 미표기 시 countryTag 폴백 — manifest
  const pool = regionPool.length > 0 ? regionPool : items
  const cityKeys = resolveMegaMenuGroupCityKeys(regionId, mg)
  if (cityKeys.length > 0) {
    return filterItemsByMenuGroupCityKeys(pool, regionId, mg)
  }

  const exclusive = resolveMegaMenuEuropeMenuGroupExclusiveFilter(regionId, mg)
  if (exclusive && exclusive.include.length > 0) {
    return filterItemsByMenuGroupCountryKeys(pool, exclusive.include, exclusive.exclude)
  }

  const countryKeys = resolveMegaMenuGroupCountryKeySlugs(regionId, mg)
  if (countryKeys.length > 0) {
    return filterItemsByMenuGroupCountryKeys(pool, countryKeys)
  }

  return []
}

/**
 * 해외 허브 — 전량 카탈로그 또는 서버 geo 목록을 URL `region`/`country`/`city`/`menuGroup`로 클라이언트 필터.
 * 중분류=그룹 태그, 하분류=중분류 풀에서 city 재좁힘.
 * type=travel 패키지, type=air-hotel 자유여행. type 없으면 둘 다.
 */
export function filterOverseasHubCatalogByUrl(
  items: ResultItem[],
  searchParams: URLSearchParams,
): ResultItem[] {
  const typed = filterOverseasHubCatalogByTravelType(items, parseOverseasHubTravelType(searchParams))
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
  if (!hasGeo) return typed

  if (region === 'sports_theme' || sportsThemeParam) {
    const tag = sportsThemeTagForBrowseRegion(region, sportsThemeParam)
    if (!tag) return typed.filter((it) => (it.sportsThemeTags?.length ?? 0) > 0)
    return typed.filter((it) => it.sportsThemeTags?.includes(tag))
  }

  if (menuGroup && region) {
    const byMenuGroup = filterOverseasHubCatalogByMenuGroup(typed, region, menuGroup)
    if (byMenuGroup) {
      const cityParam = city || destination
      if (cityParam) {
        const geo = buildBrowseUrlGeoFromParams(region, country, cityParam)
        const byGeo = filterItemsByBrowseUrlGeo(byMenuGroup, geo)
        if (byGeo) return byGeo
        return filterItemsByCityNeedle(byMenuGroup, cityParam)
      }
      return byMenuGroup
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
    if (indexed) return filterOverseasHubCatalogByTravelType(indexed, parseOverseasHubTravelType(searchParams))

    return filterCatalogByMegaRegionTab(typed, region)
  }

  if (country || city || destination) {
    const geo = buildBrowseUrlGeoFromParams(region, country, city || destination)
    const byGeo = filterItemsByBrowseUrlGeo(typed, geo)
    if (byGeo) return byGeo
  }

  if (country) {
    return typed.filter((it) => itemMatchesBrowseCountryParam(it, country))
  }

  const cityNeedle = city || destination
  if (cityNeedle) {
    return filterItemsByCityNeedle(typed, cityNeedle)
  }

  return typed
}
