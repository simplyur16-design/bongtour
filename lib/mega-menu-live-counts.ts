/**
 * 메가메뉴 링크별 공개 상품 수(서버 전용). browse와 같은 DB 조건(등록·공개·해외·geo)으로 count만 센다.
 * - DB count가 0이면 browse 목록도 0건이다(browse는 DB 결과에서 더 거르기만 함) → 숨김 판단에 안전.
 * - 수는 정렬용 근사치다(browse 메모리 필터 전 값).
 * REGRESSION-FREEZE[mega-menu-live-auto-1122]: 링크별 공개 상품 수 — manifest
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { prismaWhereForBrowseTravelScope } from '@/lib/travel-scope-pool-filter'
import { prismaWhereClausesForBrowseListingSlice } from '@/lib/products-browse-db-where'
import {
  buildOverseasBrowseGeoResolution,
  prismaWhereProductCountryTagKeysIn,
  resolveBrowseRegionToCountryKeys,
} from '@/lib/browse-master-geo'
import {
  localDepartureTagForBrowseRegion,
  sportsThemeTagForBrowseRegion,
} from '@/lib/browse-master-geo-continents'
import { TOP_NAV_MEGA_REGIONS } from '@/lib/top-nav-resolve'
import { collectMegaMenuHrefs, type MegaMenuLiveCounts } from '@/lib/mega-menu-live-menu'

export async function megaMenuHrefGeoWhere(href: string): Promise<Prisma.ProductWhereInput[]> {
  const sp = new URL(href, 'https://bongtour.com').searchParams
  const region = (sp.get('region') ?? '').trim()
  const country = (sp.get('country') ?? '').trim()
  const city = (sp.get('city') ?? '').trim()
  const menuGroup = (sp.get('menuGroup') ?? '').trim()
  const sportsTheme = (sp.get('sportsTheme') ?? '').trim()
  const localDep = localDepartureTagForBrowseRegion(region)
  if (localDep) return [{ localDepartureTag: { has: localDep } }]
  if (region === 'sports_theme' || sportsTheme) {
    const tag = sportsThemeTagForBrowseRegion(region, sportsTheme || null)
    return [tag ? { sportsThemeTag: { has: tag } } : { sportsThemeTag: { isEmpty: false } }]
  }
  if (region && !country && !city && !menuGroup) {
    return [prismaWhereProductCountryTagKeysIn(await resolveBrowseRegionToCountryKeys(region))]
  }
  const geo = await buildOverseasBrowseGeoResolution({
    region: region || null,
    country: country || null,
    city: city || null,
    menuGroup: menuGroup || null,
  })
  return geo.whereClauses
}

export async function countPublicProductsForMegaMenuHref(href: string): Promise<number> {
  const sp = new URL(href, 'https://bongtour.com').searchParams
  const geo = await megaMenuHrefGeoWhere(href)
  const scope = prismaWhereForBrowseTravelScope('overseas')
  const slice = prismaWhereClausesForBrowseListingSlice({
    scope: 'overseas',
    typeParam: sp.get('type'),
    listingKindParsed: null,
  })
  return prisma.product.count({
    where: {
      registrationStatus: 'registered',
      AND: [...geo, ...(scope ? [scope] : []), ...slice, publicProductWhereClause()],
    },
  })
}

export type MegaMenuLiveCountsPayload = { at: string; counts: MegaMenuLiveCounts; failed: number }

/** 메뉴 전체 링크 수 계산 — 동시 3개, 링크 하나 실패는 건너뜀(수 모름=보이게 둠) */
export async function computeMegaMenuLiveCounts(): Promise<MegaMenuLiveCountsPayload> {
  const hrefs = collectMegaMenuHrefs(TOP_NAV_MEGA_REGIONS)
  const counts: MegaMenuLiveCounts = {}
  let failed = 0
  let i = 0
  const worker = async () => {
    while (i < hrefs.length) {
      const h = hrefs[i++]!
      try {
        counts[h] = await countPublicProductsForMegaMenuHref(h)
      } catch {
        failed++
      }
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return { at: new Date().toISOString(), counts, failed }
}
