/**
 * I-4: Browse URL → SSOT 마스터(Continent / City) 키·Prisma where 조각.
 * 메가메뉴 트리 데이터는 건드리지 않는다.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  browseRegionToDbContinents,
  dbContinentsToProductCountryTagGroupKeys,
  resolveBrowseCityParamToCountryTagNodeKeys,
  resolveBrowseCountryParamToCountryKeySlugs,
  resolveBrowseCountryParamToDbCountries,
  resolveBrowseCityParamToDbCity,
} from '@/lib/browse-country-url-resolve'
import { countrySlugFromLabel } from '@/lib/location-url-slugs'

/** DB `Product.continent` 슬러그 → `Continent.continentKey` (1:N 가능) */
const DB_BROWSE_CONTINENT_TO_MASTER: Record<string, string[]> = {
  japan: ['northeast-asia'],
  'southeast-asia': ['southeast-asia'],
  'china-mongolia-ca': ['northeast-asia'],
  'hongkong-macau': ['northeast-asia'],
  europe: ['europe'],
  'me-africa': ['middle-east', 'africa'],
  oceania: ['oceania'],
  americas: ['north-america', 'south-america'],
}

export function masterContinentKeysFromBrowseDbContinents(dbContinents: string[]): string[] {
  const out = new Set<string>()
  for (const raw of dbContinents) {
    const k = raw.trim().toLowerCase()
    const hit = DB_BROWSE_CONTINENT_TO_MASTER[k]
    if (hit) hit.forEach((x) => out.add(x))
  }
  return [...out]
}

export function masterContinentKeysFromBrowseRegion(region: string | null | undefined): string[] {
  return masterContinentKeysFromBrowseDbContinents(browseRegionToDbContinents(region))
}

/** G-3 continent OR 태그 groupKey (라우트와 동일 로직) */
export function prismaContinentOrTagGroupKeysG3(continentList: string[]): Prisma.ProductWhereInput {
  const tagGks = dbContinentsToProductCountryTagGroupKeys(continentList)
  const primary: Prisma.ProductWhereInput =
    continentList.length === 1
      ? { continent: continentList[0]! }
      : { OR: continentList.map((continent) => ({ continent })) }
  if (tagGks.length === 0) return primary
  return {
    OR: [primary, { countryTags: { some: { groupKey: { in: tagGks } } } }],
  }
}

/**
 * 권역 탭: 마스터 continentKey / 태그→Country.continentKey OR,
 * `Product.continentKey`가 비어 있으면 G-3(continent·groupKey 태그) 폴백.
 */
export function prismaWhereContinentMasterOrTagWithLegacyNull(
  continentList: string[],
): Prisma.ProductWhereInput {
  const masterKeys = masterContinentKeysFromBrowseDbContinents(continentList)
  const g3 = prismaContinentOrTagGroupKeysG3(continentList)
  if (masterKeys.length === 0) return g3

  const i4: Prisma.ProductWhereInput = {
    OR: [
      { continentKey: { in: masterKeys } },
      { countryTags: { some: { country: { continentKey: { in: masterKeys } } } } },
    ],
  }

  return {
    OR: [i4, { AND: [{ continentKey: null }, g3] }],
  }
}

/** G-3 country (한글) OR 태그 countryKey */
export function prismaCountryOrTagCountryKeysG3(countryParam: string): Prisma.ProductWhereInput {
  const dbCountries = resolveBrowseCountryParamToDbCountries(countryParam)
  const slugKeys = resolveBrowseCountryParamToCountryKeySlugs(countryParam)
  if (dbCountries.length === 0) return { country: { in: [] } }
  const primary: Prisma.ProductWhereInput =
    dbCountries.length === 1 ? { country: dbCountries[0]! } : { country: { in: dbCountries } }
  if (slugKeys.length === 0) return primary
  return {
    OR: [primary, { countryTags: { some: { countryKey: { in: slugKeys } } } }],
  }
}

/**
 * 국가: `Product.countryKey`(트리·마스터 FK 동일 스펙) OR 태그,
 * `countryKey`가 비어 있으면 G-3(한글 country·태그) 폴백.
 */
export function prismaWhereCountryTreeKeyOrTagWithLegacyNull(countryParam: string): Prisma.ProductWhereInput {
  const slugKeys = resolveBrowseCountryParamToCountryKeySlugs(countryParam)
  const g3 = prismaCountryOrTagCountryKeysG3(countryParam)

  if (slugKeys.length === 0) return g3

  const i4: Prisma.ProductWhereInput = {
    OR: [
      { countryKey: { in: slugKeys } },
      { countryTags: { some: { countryKey: { in: slugKeys } } } },
    ],
  }

  return {
    OR: [i4, { AND: [{ countryKey: null }, g3] }],
  }
}

let megaMenuCardCitySlugCache: Map<string, string[]> | null = null

async function loadMegaMenuCardSlugToCityKeys(): Promise<Map<string, string[]>> {
  if (megaMenuCardCitySlugCache) return megaMenuCardCitySlugCache
  const cards = await prisma.megaMenuGroupCard.findMany({
    select: {
      koreanLabel: true,
      cities: { select: { cityKey: true }, orderBy: { sortOrder: 'asc' } },
    },
  })
  const m = new Map<string, string[]>()
  for (const card of cards) {
    const slug = countrySlugFromLabel(card.koreanLabel).toLowerCase()
    if (!slug || card.cities.length === 0) continue
    const keys = card.cities.map((c) => c.cityKey)
    const prev = m.get(slug)
    m.set(slug, prev ? [...new Set([...prev, ...keys])] : keys)
  }
  megaMenuCardCitySlugCache = m
  return m
}

/**
 * browse country/city 슬러그 + 트리 nodeKey 후보 + 메가메뉴 카드(라벨 슬러그 일치)에 매달린 도시 키.
 */
export async function expandMasterCityKeysForBrowseGeo(
  countryParam: string | null | undefined,
  cityParam: string | null | undefined,
): Promise<string[]> {
  const co = (countryParam ?? '').trim().toLowerCase()
  const ct = (cityParam ?? '').trim().toLowerCase()
  const keys = new Set<string>()
  for (const nk of resolveBrowseCityParamToCountryTagNodeKeys(cityParam)) {
    if (nk) keys.add(nk)
  }
  if (ct && /^[a-z0-9-]+$/.test(ct)) keys.add(ct)

  const cardMap = await loadMegaMenuCardSlugToCityKeys()
  for (const slug of [co, ct]) {
    if (!slug) continue
    const list = cardMap.get(slug)
    if (list?.length) list.forEach((k) => keys.add(k))
  }

  return [...keys].filter(Boolean)
}

/**
 * 도시: 마스터 cityKey / ProductCityTag OR,
 * `cityKey`가 비어 있으면 G-3(city 한글·countryTags.nodeKey) 폴백.
 */
export async function prismaWhereCityMasterOrTagWithLegacyNull(
  countryParam: string | null | undefined,
  cityParam: string | null | undefined,
): Promise<Prisma.ProductWhereInput> {
  const masterCityKeys = await expandMasterCityKeysForBrowseGeo(countryParam, cityParam)
  const dbCity = resolveBrowseCityParamToDbCity(cityParam)
  const nodeKeys = resolveBrowseCityParamToCountryTagNodeKeys(cityParam)

  const i4parts: Prisma.ProductWhereInput[] = []
  if (masterCityKeys.length > 0) {
    i4parts.push({ cityKey: { in: masterCityKeys } })
    i4parts.push({ cityTags: { some: { cityKey: { in: masterCityKeys } } } })
  }
  const i4: Prisma.ProductWhereInput | null =
    i4parts.length === 0 ? null : i4parts.length === 1 ? i4parts[0]! : { OR: i4parts }

  const legacyParts: Prisma.ProductWhereInput[] = []
  if (dbCity) legacyParts.push({ city: dbCity })
  if (nodeKeys.length > 0) {
    legacyParts.push({ countryTags: { some: { nodeKey: { in: nodeKeys } } } })
  }
  const legacy: Prisma.ProductWhereInput | null =
    legacyParts.length === 0
      ? null
      : legacyParts.length === 1
        ? legacyParts[0]!
        : { OR: legacyParts }

  if (i4 && legacy) {
    return {
      OR: [i4, { AND: [{ cityKey: null }, legacy] }],
    }
  }
  if (i4) return i4
  if (legacy) return legacy
  return { country: { in: [] } }
}
