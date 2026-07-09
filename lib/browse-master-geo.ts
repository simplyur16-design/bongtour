/**
 * Browse URL → Prisma where (ProductCountryTag / ProductCityTag 단일 SSOT).
 * `Product.continent`·한글 `Product.country` 레거시 필드는 browse where에 쓰지 않는다.
 * REGRESSION-FREEZE[europe-western-eastern-exclusive]: 서유럽·동유럽·북유럽 menuGroup 상호 배제 — manifest
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  resolveBrowseCityKeysForFilter,
  resolveBrowseCountryParamToCountryKeySlugs,
} from '@/lib/browse-country-url-resolve'
import {
  browseTabIdToMegaMenuCardKeys,
  masterContinentKeysFromBrowseRegion,
} from '@/lib/browse-master-geo-continents'
import {
  resolveMegaMenuEuropeMenuGroupExclusiveFilter,
  resolveMegaMenuGroupCityKeys,
  resolveMegaMenuGroupCountryKeySlugs,
  resolveMegaMenuMenuGroupSlugToCountryKeySlugs,
} from '@/lib/mega-menu-browse-group'

export {
  browseTabIdToMegaMenuCardKeys,
  localDepartureTagForBrowseRegion,
  masterContinentKeysFromBrowseDbContinents,
  masterContinentKeysFromBrowseRegion,
  sportsThemeTagForBrowseRegion,
} from '@/lib/browse-master-geo-continents'

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
async function countryKeysFromMegaMenuCardKeys(cardKeys: string[]): Promise<string[]> {
  const keys = uniqueNonEmpty(cardKeys)
  if (keys.length === 0) return []
  const rows = await prisma.megaMenuGroupCardCountry.findMany({
    where: { cardKey: { in: keys }, card: { isActive: true } },
    select: { countryKey: true },
    distinct: ['countryKey'],
    orderBy: { countryKey: 'asc' },
  })
  return rows.map((r) => r.countryKey)
}

/** SSOT 탭 id → 해당 탭에 묶인 모든 카드의 cityKey */
export async function resolveBrowseTabIdToCityKeys(regionId: string | null | undefined): Promise<string[]> {
  const cardKeys = browseTabIdToMegaMenuCardKeys(regionId)
  if (cardKeys.length === 0) return []
  const rows = await prisma.megaMenuGroupCardCity.findMany({
    where: { cardKey: { in: cardKeys }, card: { isActive: true } },
    select: { cityKey: true },
    distinct: ['cityKey'],
    orderBy: { cityKey: 'asc' },
  })
  return rows.map((r) => r.cityKey)
}

export async function resolveBrowseRegionToCountryKeys(region: string | null | undefined): Promise<string[]> {
  const k = (region ?? '').trim()
  if (!k) return []

  const direct = await resolveBrowseCardKeyToCountryKeys(k)
  if (direct.length > 0) return uniqueNonEmpty(direct)

  const tabCardKeys = browseTabIdToMegaMenuCardKeys(k)
  if (tabCardKeys.length > 0) {
    return countryKeysFromMegaMenuCardKeys(tabCardKeys)
  }

  const menuGroupCountryKeys = resolveMegaMenuMenuGroupSlugToCountryKeySlugs(k)
  if (menuGroupCountryKeys.length > 0) {
    return menuGroupCountryKeys
  }

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

/** include countryTag 일치 + exclude countryTag 없음 */
export function prismaWhereProductCountryTagKeysIncludingExcluding(
  includeKeys: string[],
  excludeKeys: string[],
): Prisma.ProductWhereInput {
  const include = uniqueNonEmpty(includeKeys)
  const exclude = uniqueNonEmpty(excludeKeys)
  const parts: Prisma.ProductWhereInput[] = [prismaWhereProductCountryTagKeysIn(include)]
  if (exclude.length > 0) {
    parts.push({
      NOT: { countryTags: { some: { countryKey: { in: exclude } } } },
    })
  }
  return parts.length === 1 ? parts[0]! : { AND: parts }
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
  /** 메가메뉴 열(홋카이도·미서부 등) — `country`가 일본/중국일 때 좁히기 */
  menuGroup?: string | null
}): Promise<OverseasBrowseGeoResolution> {
  const r = (input.region ?? '').trim()
  const c = (input.country ?? '').trim()
  const ct = (input.city ?? '').trim()
  const mg = (input.menuGroup ?? '').trim().toLowerCase()
  const whereClauses: Prisma.ProductWhereInput[] = []
  let regionCountryKeys: string[] = []

  if (r) {
    regionCountryKeys = await resolveBrowseRegionToCountryKeys(r)
    let countryKeys = c ? intersectBrowseCountryKeys(regionCountryKeys, c) : regionCountryKeys
    /** 열 전용 슬러그(스포츠 테마 등)는 countryKey에 없음 — 권역만 걸고 menuGroup·terms로 좁힘 */
    if (countryKeys.length === 0 && mg && regionCountryKeys.length > 0) {
      countryKeys = regionCountryKeys
    }
    whereClauses.push(prismaWhereProductCountryTagKeysIn(countryKeys))
  } else if (c) {
    whereClauses.push(
      prismaWhereProductCountryTagKeysIn(resolveBrowseCountryParamToCountryKeySlugs(c)),
    )
  }

  const countryScopeForCity = (): string[] =>
    regionCountryKeys.length > 0
      ? c
        ? intersectBrowseCountryKeys(regionCountryKeys, c)
        : regionCountryKeys
      : c
        ? resolveBrowseCountryParamToCountryKeySlugs(c)
        : []

  if (ct) {
    let cityKeys = resolveBrowseCityKeysForFilter(ct)
    if (r) {
      let cardCityKeys = await resolveBrowseCardKeyToCityKeys(r)
      if (cardCityKeys.length === 0) {
        cardCityKeys = await resolveBrowseTabIdToCityKeys(r)
      }
      if (cardCityKeys.length > 0) {
        const allowed = new Set(cardCityKeys)
        cityKeys = cityKeys.filter((k) => allowed.has(k))
      }
    }
    if (mg && r) {
      const groupCityKeys = resolveMegaMenuGroupCityKeys(r, mg)
      if (groupCityKeys.length > 0) {
        const allowed = new Set(groupCityKeys)
        cityKeys = cityKeys.filter((k) => allowed.has(k))
      }
    }
    whereClauses.push(prismaWhereBrowseCityKeys(cityKeys, countryScopeForCity()))
  } else if (mg && r) {
    const groupCityKeys = resolveMegaMenuGroupCityKeys(r, mg)
    if (groupCityKeys.length > 0) {
      whereClauses.push(prismaWhereBrowseCityKeys(groupCityKeys, countryScopeForCity()))
    } else {
      const exclusive = resolveMegaMenuEuropeMenuGroupExclusiveFilter(r, mg)
      const groupCountryKeys = resolveMegaMenuGroupCountryKeySlugs(r, mg)
      if (exclusive && exclusive.include.length > 0) {
        let include = exclusive.include
        if (regionCountryKeys.length > 0) {
          include = include.filter((k) => regionCountryKeys.includes(k))
        }
        if (c) {
          const fromUrl = intersectBrowseCountryKeys(
            regionCountryKeys.length > 0 ? regionCountryKeys : exclusive.include,
            c,
          )
          include = fromUrl.length > 0 ? fromUrl : include
        }
        let exclude = exclusive.exclude
        if (regionCountryKeys.length > 0 && exclude.length > 0) {
          exclude = exclude.filter((k) => regionCountryKeys.includes(k))
        }
        whereClauses.push(prismaWhereProductCountryTagKeysIncludingExcluding(include, exclude))
      } else if (groupCountryKeys.length > 0) {
        const scoped =
          regionCountryKeys.length > 0
            ? groupCountryKeys.filter((k) => regionCountryKeys.includes(k))
            : groupCountryKeys
        if (c) {
          const fromUrl = intersectBrowseCountryKeys(
            regionCountryKeys.length > 0 ? regionCountryKeys : groupCountryKeys,
            c,
          )
          whereClauses.push(prismaWhereProductCountryTagKeysIn(fromUrl.length > 0 ? fromUrl : scoped))
        } else {
          whereClauses.push(prismaWhereProductCountryTagKeysIn(scoped))
        }
      }
    }
  }

  return { whereClauses, regionCountryKeys }
}
