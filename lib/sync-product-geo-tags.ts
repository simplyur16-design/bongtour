/**
 * 해외 상품 geo 태그 일괄 동기화 — 등록·백필 공통 진입점.
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

export type SyncProductGeoTagsOpts = SyncProductCountryTagsOpts & SyncProductCityTagsOpts

export type SyncProductGeoTagsResult = {
  country: Awaited<ReturnType<typeof syncProductCountryTags>>
  cityTagCount: number
  cityKeys: string[]
  cityKey: string | null
  supplementalCountryTagCount: number
}

/** ProductCountryTag + ProductCityTag — 메가메뉴 browse Prisma where와 정합 */
export async function syncProductGeoTags(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  productId: string,
  geo: ProductLocationKeyPrismaFields,
  opts: SyncProductGeoTagsOpts,
): Promise<SyncProductGeoTagsResult> {
  const country = await syncProductCountryTags(db, productId, geo, opts)
  const { tagCount: cityTagCount, cityKeys, cityKey } = await syncProductCityTags(db, productId, geo, opts)
  const supplementalCountryTagCount = await syncSupplementalCountryTagsFromCityKeys(
    db,
    productId,
    cityKeys,
  )
  return { country, cityTagCount, cityKeys, cityKey, supplementalCountryTagCount }
}
