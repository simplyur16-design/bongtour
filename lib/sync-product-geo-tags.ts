/**
 * 해외 상품 geo 태그 일괄 동기화 — 등록·백필 공통 진입점.
 * REGRESSION-FREEZE[supplier-register-mega-menu-geo]: confirm은 syncProductGeoTagsForRegister — manifest
 */
import type { Prisma } from '@prisma/client'
import type { ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'
import {
  syncProductCityTags,
  type SyncProductCityTagsOpts,
} from '@/lib/sync-product-city-tags'
import {
  syncProductCountryTags,
  syncSupplementalCountryTagsFromCityKeys,
  type SyncProductCountryTagsOpts,
} from '@/lib/sync-product-country-tags'
import {
  buildRegisterMegaMenuGeoSummary,
  megaMenuSummaryNeedsOperatorReview,
  type RegisterMegaMenuGeoSummary,
} from '@/lib/register-mega-menu-geo-summary'

export type SyncProductGeoTagsOpts = SyncProductCountryTagsOpts & SyncProductCityTagsOpts

export type SyncProductGeoTagsResult = {
  country: Awaited<ReturnType<typeof syncProductCountryTags>>
  cityTagCount: number
  cityKeys: string[]
  cityKey: string | null
  supplementalCountryTagCount: number
  /** 등록 confirm — 메가메뉴 대·중·소분류 정합 요약 */
  megaMenuSummary: RegisterMegaMenuGeoSummary
}

/** ProductCountryTag + ProductCityTag — 메가메뉴 browse Prisma where와 정합 */
export async function syncProductGeoTags(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  productId: string,
  geo: ProductLocationKeyPrismaFields,
  opts: SyncProductGeoTagsOpts,
): Promise<SyncProductGeoTagsResult> {
  const country = await syncProductCountryTags(db, productId, geo, opts)
  const countryTagRows = await db.productCountryTag.findMany({
    where: { productId },
    select: { countryKey: true },
    orderBy: { sortOrder: 'asc' },
  })
  const allowedCountryKeys = countryTagRows.map((t) => t.countryKey)
  const { tagCount: cityTagCount, cityKeys, cityKey } = await syncProductCityTags(db, productId, geo, {
    ...opts,
    allowedCountryKeys,
  })
  const supplementalCountryTagCount = await syncSupplementalCountryTagsFromCityKeys(
    db,
    productId,
    cityKeys,
  )
  const countryTagKeys =
    country.plan.kind === 'multi' && country.plan.countryKeys.length >= 2
      ? country.plan.countryKeys
      : geo.countryKey?.trim()
        ? [geo.countryKey.trim()]
        : []
  const megaMenuSummary = buildRegisterMegaMenuGeoSummary({
    geo,
    cityKeys,
    countryTagKeys,
    tagOpts: {
      title: opts.title,
      primaryDestination: opts.primaryDestination,
      destinationRaw: opts.destinationRaw,
      scheduleHaystack: opts.scheduleHaystack,
    },
  })
  if (megaMenuSummary.warnings.length > 0) {
    console.warn('[syncProductGeoTags] mega menu geo gaps', {
      productId,
      browseRegionTab: megaMenuSummary.browseRegionTab,
      subgroupLabel: megaMenuSummary.subgroupLabel,
      warnings: megaMenuSummary.warnings,
    })
  }
  return { country, cityTagCount, cityKeys, cityKey, supplementalCountryTagCount, megaMenuSummary }
}

/**
 * 등록 confirm — geo 태그 동기화 후 메가메뉴 대·중·소분류 미달 시 registered → pending 강등.
 * 전 공급사 orchestration은 `syncProductGeoTags` 대신 본 함수만 호출한다.
 */
export async function syncProductGeoTagsForRegister(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  productId: string,
  geo: ProductLocationKeyPrismaFields,
  opts: SyncProductGeoTagsOpts,
): Promise<SyncProductGeoTagsResult> {
  const result = await syncProductGeoTags(db, productId, geo, opts)
  if (!megaMenuSummaryNeedsOperatorReview(result.megaMenuSummary)) return result

  const downgraded = await db.product.updateMany({
    where: { id: productId, registrationStatus: 'registered' },
    data: { registrationStatus: 'pending' },
  })
  if (downgraded.count > 0) {
    console.warn('[syncProductGeoTagsForRegister] mega menu geo gaps — registrationStatus pending', {
      productId,
      browseRegionTab: result.megaMenuSummary.browseRegionTab,
      subgroupLabel: result.megaMenuSummary.subgroupLabel,
      warnings: result.megaMenuSummary.warnings,
    })
  }
  return result
}
