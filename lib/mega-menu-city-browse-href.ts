/**
 * 메가메뉴 leaf·DB 카드 도시 → 해외 browse URL (`/travel/overseas?…`) SSOT.
 * 추천 여행지·페르소나 카드 CTA는 `destination=` 이 아닌 이 href를 쓴다.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveBrowseCityKeysForFilter } from '@/lib/browse-country-url-resolve'
import { citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { buildMegaMenuLeafHref } from '@/lib/top-nav-resolve'
import type { BrowseUrlGeo } from '@/lib/match-overseas-product'
import { buildOverseasBrowseGeoResolution } from '@/lib/browse-master-geo'
import { browseTabIdToMegaMenuCardKeys, masterContinentKeysFromBrowseRegion } from '@/lib/browse-master-geo-continents'
import { resolveMegaMenuMenuGroupSlugToCountryKeySlugs } from '@/lib/mega-menu-browse-group'

type Db = Prisma.TransactionClient | typeof prisma

let uiCityHrefCache: Map<string, string> | null = null

function buildUiCityBrowseHrefIndex(): Map<string, string> {
  const map = new Map<string, string>()
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture || !tab.groups.length) continue
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        const href = buildMegaMenuLeafHref({
          type: 'travel',
          regionId: tab.id,
          countryLabel: group.countryLabel,
          headerBrowseCountryLabel: group.headerBrowseCountryLabel,
          leaf,
        })
        const slug =
          leaf.kind === 'city'
            ? citySlugFromTermsAndLabel(leaf.label, leaf.terms)
            : citySlugFromTermsAndLabel(leaf.label, leaf.terms)
        for (const ck of resolveBrowseCityKeysForFilter(slug)) {
          if (!map.has(ck)) map.set(ck, href)
        }
      }
    }
  }
  return map
}

function uiCityBrowseHrefIndex(): Map<string, string> {
  if (!uiCityHrefCache) uiCityHrefCache = buildUiCityBrowseHrefIndex()
  return uiCityHrefCache
}

export function resetMegaMenuCityBrowseHrefCache(): void {
  uiCityHrefCache = null
}

function parseBrowseHref(href: string): URLSearchParams {
  try {
    const u = new URL(href, 'https://bongtour.local')
    return u.searchParams
  } catch {
    const q = href.includes('?') ? href.slice(href.indexOf('?') + 1) : ''
    return new URLSearchParams(q)
  }
}

function uniqueNonEmpty(keys: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of keys) {
    const k = raw.trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

function hrefFromCardOnlyRow(row: {
  cardKey: string
  city: { cityKey: string; koreanLabel: string; countryKey: string }
}): string {
  const citySlug = citySlugFromTermsAndLabel(row.city.koreanLabel, [row.city.cityKey])
  const params = new URLSearchParams()
  params.set('scope', 'overseas')
  params.set('region', row.cardKey)
  params.set('country', row.city.countryKey.trim())
  params.set('city', citySlug)
  return `/travel/overseas?${params.toString()}`
}

async function buildCardOnlyCityBrowseHref(
  db: Db,
  cityKey: string,
): Promise<string | null> {
  const row = await db.megaMenuGroupCardCity.findFirst({
    where: { cityKey, card: { isActive: true } },
    orderBy: { sortOrder: 'asc' },
    select: {
      cardKey: true,
      city: { select: { cityKey: true, koreanLabel: true, countryKey: true } },
    },
  })
  if (!row?.city) return null
  return hrefFromCardOnlyRow({ cardKey: row.cardKey, city: row.city })
}

async function resolveMegaMenuBrowseHrefsByCityKeys(
  cityKeys: string[],
  db: Db,
): Promise<Map<string, string>> {
  const ui = uiCityBrowseHrefIndex()
  const out = new Map<string, string>()
  const misses: string[] = []

  for (const ck of cityKeys) {
    const href = ui.get(ck)
    if (href) out.set(ck, href)
    else misses.push(ck)
  }

  if (misses.length === 0) return out

  const rows = await db.megaMenuGroupCardCity.findMany({
    where: { cityKey: { in: misses }, card: { isActive: true } },
    orderBy: [{ cityKey: 'asc' }, { sortOrder: 'asc' }],
    select: {
      cityKey: true,
      cardKey: true,
      city: { select: { cityKey: true, koreanLabel: true, countryKey: true } },
    },
  })

  const seen = new Set<string>()
  for (const row of rows) {
    if (!row.city || seen.has(row.cityKey)) continue
    seen.add(row.cityKey)
    out.set(row.cityKey, hrefFromCardOnlyRow({ cardKey: row.cardKey, city: row.city }))
  }

  return out
}

type MegaMenuRegionCountryIndex = Map<string, string[]>

async function buildMegaMenuRegionCountryIndex(
  db: Db,
  regions: string[],
): Promise<MegaMenuRegionCountryIndex> {
  const uniqRegions = uniqueNonEmpty(regions)
  const out: MegaMenuRegionCountryIndex = new Map()
  if (uniqRegions.length === 0) return out

  const cardKeysToFetch = new Set<string>()
  const tabRegionCardKeys = new Map<string, string[]>()
  const continentByRegion = new Map<string, string[]>()

  for (const region of uniqRegions) {
    const menuGroupKeys = resolveMegaMenuMenuGroupSlugToCountryKeySlugs(region)
    if (menuGroupKeys.length > 0) {
      out.set(region, uniqueNonEmpty(menuGroupKeys))
      continue
    }

    cardKeysToFetch.add(region)

    const tabCardKeys = browseTabIdToMegaMenuCardKeys(region)
    if (tabCardKeys.length > 0) {
      tabRegionCardKeys.set(region, tabCardKeys)
      for (const ck of tabCardKeys) cardKeysToFetch.add(ck)
    }

    const continentKeys = masterContinentKeysFromBrowseRegion(region)
    if (continentKeys.length > 0) {
      continentByRegion.set(region, continentKeys)
    }
  }

  const allCardKeys = [...cardKeysToFetch]
  const allContinentKeys = uniqueNonEmpty([...continentByRegion.values()].flat())

  const [cardCountryRows, continentCountryRows] = await Promise.all([
    allCardKeys.length > 0
      ? db.megaMenuGroupCardCountry.findMany({
          where: { cardKey: { in: allCardKeys }, card: { isActive: true } },
          select: { cardKey: true, countryKey: true, sortOrder: true },
          orderBy: [{ cardKey: 'asc' }, { sortOrder: 'asc' }],
        })
      : Promise.resolve([]),
    allContinentKeys.length > 0
      ? db.megaMenuGroupCardCountry.findMany({
          where: { card: { isActive: true, continentKey: { in: allContinentKeys } } },
          select: { countryKey: true, card: { select: { continentKey: true } } },
          orderBy: { countryKey: 'asc' },
        })
      : Promise.resolve([]),
  ])

  const countriesByCardKey = new Map<string, string[]>()
  for (const row of cardCountryRows) {
    const list = countriesByCardKey.get(row.cardKey) ?? []
    if (!list.includes(row.countryKey)) list.push(row.countryKey)
    countriesByCardKey.set(row.cardKey, list)
  }

  const countriesByContinentKey = new Map<string, string[]>()
  for (const row of continentCountryRows) {
    const continentKey = row.card.continentKey
    const list = countriesByContinentKey.get(continentKey) ?? []
    if (!list.includes(row.countryKey)) list.push(row.countryKey)
    countriesByContinentKey.set(continentKey, list)
  }

  function distinctCountryKeysForTabCardKeys(cardKeys: string[]): string[] {
    const keys = new Set<string>()
    for (const ck of cardKeys) {
      for (const countryKey of countriesByCardKey.get(ck) ?? []) keys.add(countryKey)
    }
    return [...keys].sort()
  }

  for (const region of uniqRegions) {
    if (out.has(region)) continue

    const direct = countriesByCardKey.get(region)
    if (direct && direct.length > 0) {
      out.set(region, [...direct])
      continue
    }

    const tabCards = tabRegionCardKeys.get(region)
    if (tabCards) {
      out.set(region, distinctCountryKeysForTabCardKeys(tabCards))
      continue
    }

    const continentKeys = continentByRegion.get(region)
    if (continentKeys) {
      const keys = new Set<string>()
      for (const ck of continentKeys) {
        for (const countryKey of countriesByContinentKey.get(ck) ?? []) keys.add(countryKey)
      }
      out.set(region, [...keys].sort())
      continue
    }

    out.set(region, [])
  }

  return out
}

function browseUrlGeoFromHref(
  params: URLSearchParams,
  regionCountryIndex: MegaMenuRegionCountryIndex,
): BrowseUrlGeo {
  const region = params.get('region')
  const regionCountryKeys = region?.trim()
    ? regionCountryIndex.get(region.trim()) ?? []
    : []

  return {
    region: params.get('region'),
    country: params.get('country'),
    city: params.get('city'),
    regionCountryKeys,
  }
}

/** batch SQL — cityKeys[] → Map<cityKey, BrowseUrlGeo> (parity test·내부 SSOT) */
export async function loadMegaMenuBrowseUrlGeoByCityKeysBatch(
  cityKeys: string[],
  db: Db = prisma,
): Promise<Map<string, BrowseUrlGeo>> {
  const uniq = uniqueNonEmpty(cityKeys)
  if (uniq.length === 0) return new Map()

  const hrefByCity = await resolveMegaMenuBrowseHrefsByCityKeys(uniq, db)
  const parsed = new Map<string, URLSearchParams>()
  const regions: string[] = []

  for (const ck of uniq) {
    const href = hrefByCity.get(ck)
    if (!href) continue
    const params = parseBrowseHref(href)
    parsed.set(ck, params)
    const region = params.get('region')
    if (region?.trim()) regions.push(region.trim())
  }

  const regionCountryIndex = await buildMegaMenuRegionCountryIndex(db, regions)
  const out = new Map<string, BrowseUrlGeo>()

  for (const ck of uniq) {
    const params = parsed.get(ck)
    if (!params) continue
    out.set(ck, browseUrlGeoFromHref(params, regionCountryIndex))
  }

  return out
}

/** 메가메뉴에 매핑된 도시의 browse URL. UI leaf 우선, 없으면 `MegaMenuGroupCardCity`. */
export async function resolveMegaMenuBrowseHrefForCityKey(
  cityKey: string,
  db: Db = prisma,
): Promise<string | null> {
  const k = cityKey.trim()
  if (!k) return null
  const ui = uiCityBrowseHrefIndex().get(k)
  if (ui) return ui
  return buildCardOnlyCityBrowseHref(db, k)
}

export async function buildBrowseUrlGeoForMegaMenuCityKey(
  cityKey: string,
  db: Db = prisma,
): Promise<BrowseUrlGeo | null> {
  const href = await resolveMegaMenuBrowseHrefForCityKey(cityKey, db)
  if (!href) return null
  const params = parseBrowseHref(href)
  const resolution = await buildOverseasBrowseGeoResolution({
    region: params.get('region'),
    country: params.get('country'),
    city: params.get('city'),
    menuGroup: params.get('menuGroup'),
  })
  return {
    region: params.get('region'),
    country: params.get('country'),
    city: params.get('city'),
    regionCountryKeys: resolution.regionCountryKeys,
  }
}

/** pool 도시별 browse geo — batch SQL (regionCountryKeys 2~3회 조회) */
export async function loadMegaMenuBrowseUrlGeoByCityKeys(
  cityKeys: string[],
  db: Db = prisma,
): Promise<Map<string, BrowseUrlGeo>> {
  const uniq = [...new Set(cityKeys.map((k) => k.trim()).filter(Boolean))]
  if (uniq.length === 0) return new Map()

  try {
    return await loadMegaMenuBrowseUrlGeoByCityKeysBatch(uniq, db)
  } catch (e) {
    console.error('[mega-menu-city-browse-href] batch buildBrowseUrlGeo failed', e)
    throw e
  }
}

/** 이미 로드된 geo map에서 cityKeys만 추출 — pool→resolved dedupe용 */
export function pickMegaMenuBrowseUrlGeoSubset(
  cityKeys: string[],
  source: Map<string, BrowseUrlGeo>,
): Map<string, BrowseUrlGeo> {
  const out = new Map<string, BrowseUrlGeo>()
  for (const ck of cityKeys) {
    const geo = source.get(ck)
    if (geo) out.set(ck, geo)
  }
  return out
}
