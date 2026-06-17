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
import { startOverseasColdTimingV2 } from '@/lib/overseas-cold-timing-v2'

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

  const citySlug = citySlugFromTermsAndLabel(row.city.koreanLabel, [row.city.cityKey])
  const params = new URLSearchParams()
  params.set('scope', 'overseas')
  params.set('region', row.cardKey)
  params.set('country', row.city.countryKey.trim())
  params.set('city', citySlug)
  return `/travel/overseas?${params.toString()}`
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

/** pool 도시별 browse geo — 추천 여행지·히어로 상품 매칭용 (도시별 병렬 resolve) */
export async function loadMegaMenuBrowseUrlGeoByCityKeys(
  cityKeys: string[],
  db: Db = prisma,
): Promise<Map<string, BrowseUrlGeo>> {
  const endLoad = startOverseasColdTimingV2('megaMenu.loadBrowseUrlGeoByCityKeys')
  const uniq = [...new Set(cityKeys.map((k) => k.trim()).filter(Boolean))]
  const settled = await Promise.allSettled(
    uniq.map(async (ck) => {
      const endCity = startOverseasColdTimingV2(`megaMenu.buildBrowseUrlGeo.${ck}`)
      const geo = await buildBrowseUrlGeoForMegaMenuCityKey(ck, db)
      endCity()
      return [ck, geo] as const
    }),
  )
  const out = new Map<string, BrowseUrlGeo>()
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      const [ck, geo] = result.value
      if (geo) out.set(ck, geo)
      continue
    }
    console.error('[mega-menu-city-browse-href] buildBrowseUrlGeo failed', result.reason)
  }
  endLoad()
  return out
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
