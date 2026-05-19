/**
 * Browse URL → Prisma where (ProductCountryTag / ProductCityTag 단일 SSOT).
 * `Product.continent`·한글 `Product.country` 레거시 필드는 browse where에 쓰지 않는다.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  resolveBrowseCityKeysForFilter,
  resolveBrowseCountryParamToCountryKeySlugs,
} from '@/lib/browse-country-url-resolve'
import { masterContinentKeysFromBrowseRegion } from '@/lib/browse-master-geo-continents'

export { masterContinentKeysFromBrowseDbContinents, masterContinentKeysFromBrowseRegion } from '@/lib/browse-master-geo-continents'

const BROWSE_NONE_COUNTRY_KEY = '__browse_none__'
const BROWSE_NONE_CITY_KEY = '__browse_none_city__'

/** 메가메뉴 SSOT 카드 → 연결된 마스터 도시 키 */
export async function resolveBrowseCardKeyToCityKeys(cardKey: string | null | undefined): Promise<string[]> {
  const k = (cardKey ?? '').trim()
  if (!k) return []
  const rows = await prisma.megaMenuGroupCardCity.findMany({
    where: { cardKey: k, card: { isActive: true } },
    select: { cityKey: true },
    orderBy: { sortOrder: 'asc' },
  })
  return rows.map((r) => r.cityKey)
}

/** 메가메뉴 SSOT 카드 → 연결된 마스터 국가 키 */
export async function resolveBrowseCardKeyToCountryKeys(cardKey: string | null | undefined): Promise<string[]> {
  const k = (cardKey ?? '').trim()
  if (!k) return []
  const rows = await prisma.megaMenuGroupCardCountry.findMany({
    where: { cardKey: k, card: { isActive: true } },
    select: { countryKey: true },
    orderBy: { sortOrder: 'asc' },
  })
  return rows.map((r) => r.countryKey)
}

/**
 * browse `region` → MegaMenuGroupCardCountry.countryKey 목록.
 * cardKey 직접 매칭 우선, 레거시 탭 id는 마스터 continentKey로 활성 카드 국가 합집합.
 */
export async function resolveBrowseRegionToCountryKeys(region: string | null | undefined): Promise<string[]> {
  const k = (region ?? '').trim()
  if (!k) return []

  const direct = await resolveBrowseCardKeyToCountryKeys(k)
  if (direct.length > 0) return uniqueNonEmpty(direct)

  const masterContinentKeys = masterContinentKeysFromBrowseRegion(k)
  if (masterContinentKeys.length === 0) return []

  const rows = await prisma.megaMenuGroupCardCountry.findMany({
    where: {
      card: { isActive: true, continentKey: { in: masterContinentKeys } },
    },
    select: { countryKey: true },
    distinct: ['countryKey'],
    orderBy: { countryKey: 'asc' },
  })
  return rows.map((r) => r.countryKey)
}

/** 매칭 불가(빈 IN) — registered 풀에서 제외 */
export function prismaWhereProductCountryTagKeysIn(countryKeys: string[]): Prisma.ProductWhereInput {
  const keys = uniqueNonEmpty(countryKeys)
  if (keys.length === 0) {
    return { countryTags: { some: { countryKey: { in: [BROWSE_NONE_COUNTRY_KEY] } } } }
  }
  return { countryTags: { some: { countryKey: { in: keys } } } }
}

/**
 * 도시 browse: `ProductCityTag.cityKey` 또는 (권역·국가 범위 내) `ProductCountryTag.nodeKey`.
 * 일본 도쿄 등은 cityTag 없이 countryTag.nodeKey만 있는 경우가 많다.
 */
export function prismaWhereBrowseCityKeys(
  cityKeys: string[],
  scopeCountryKeys: string[],
): Prisma.ProductWhereInput {
  const cities = uniqueNonEmpty(cityKeys)
  if (cities.length === 0) {
    return { cityTags: { some: { cityKey: { in: [BROWSE_NONE_CITY_KEY] } } } }
  }
  const orParts: Prisma.ProductWhereInput[] = [
    { cityTags: { some: { cityKey: { in: cities } } } },
  ]
  const countries = uniqueNonEmpty(scopeCountryKeys)
  if (countries.length > 0) {
    orParts.push({
      countryTags: {
        some: {
          countryKey: { in: countries },
          nodeKey: { in: cities },
        },
      },
    })
  } else {
    orParts.push({
      countryTags: { some: { nodeKey: { in: cities } } },
    })
  }
  return orParts.length === 1 ? orParts[0]! : { OR: orParts }
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

/** 카드(권역) 국가 목록 ∩ URL country 슬러그 */
export function intersectBrowseCountryKeys(
  cardCountryKeys: string[],
  countryParam: string | null | undefined,
): string[] {
  const want = resolveBrowseCountryParamToCountryKeySlugs(countryParam)
  if (want.length === 0) return []
  const allowed = new Set(cardCountryKeys.map((k) => k.trim()).filter(Boolean))
  return want.filter((k) => allowed.has(k))
}

export type OverseasBrowseGeoResolution = {
  whereClauses: Prisma.ProductWhereInput[]
  /** 메모리 매칭(`productMatchesBrowseUrlGeo`)용 — region/card 클릭 시 카드에 매핑된 countryKey */
  regionCountryKeys: string[]
}

/**
 * 해외 browse URL geo → Prisma AND 절 + regionCountryKeys.
 * - region(cardKey): ProductCountryTag.countryKey ∈ 카드 매핑 국가
 * - region + country: 위 ∩ countryKey 일치(카드에 없는 국가면 0건)
 * - city: ProductCityTag.cityKey (region 있으면 카드에 매핑된 cityKey만)
 */
export async function buildOverseasBrowseGeoResolution(input: {
  region: string | null
  country: string | null
  city: string | null
}): Promise<OverseasBrowseGeoResolution> {
  const r = (input.region ?? '').trim()
  const c = (input.country ?? '').trim()
  const ct = (input.city ?? '').trim()
  const whereClauses: Prisma.ProductWhereInput[] = []
  let regionCountryKeys: string[] = []

  if (r) {
    regionCountryKeys = await resolveBrowseRegionToCountryKeys(r)
    const countryKeys = c ? intersectBrowseCountryKeys(regionCountryKeys, c) : regionCountryKeys
    whereClauses.push(prismaWhereProductCountryTagKeysIn(countryKeys))
  } else if (c) {
    whereClauses.push(
      prismaWhereProductCountryTagKeysIn(resolveBrowseCountryParamToCountryKeySlugs(c)),
    )
  }

  if (ct) {
    let cityKeys = resolveBrowseCityKeysForFilter(ct)
    if (r) {
      const cardCityKeys = await resolveBrowseCardKeyToCityKeys(r)
      if (cardCityKeys.length > 0) {
        const allowed = new Set(cardCityKeys)
        cityKeys = cityKeys.filter((k) => allowed.has(k))
      }
    }

    const countryScope =
      regionCountryKeys.length > 0
        ? c
          ? intersectBrowseCountryKeys(regionCountryKeys, c)
          : regionCountryKeys
        : c
          ? resolveBrowseCountryParamToCountryKeySlugs(c)
          : []
    whereClauses.push(prismaWhereBrowseCityKeys(cityKeys, countryScope))
  }

  return { whereClauses, regionCountryKeys }
}
