import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getSiteOrigin } from '@/lib/site-metadata'
import {
  SITEMAP_PRODUCT_TAKE,
  SITEMAP_TRAINING_TAKE,
  sitemapPublicProductWhere,
  sitemapTrainingProgramWhere,
} from '@/lib/sitemap-product-where'
import { shouldSkipSitemapDbAtBuild } from '@/lib/sitemap-build'
import { buildPublicSitemapEntries } from '@/lib/sitemap-public-entries'
import { createLastGoodCache } from '@/lib/seo/last-good-cache'

/**
 * 요청 시 DB 조회 — `revalidate` ISR 은 빌드 시점(DB 생략) 정적 결과가 굳어 상품 URL 0건으로 남았다.
 * 상품 URL = 공개 상세와 같은 판정(registered + publicProductWhereClause), slug 우선 주소.
 * 등록·수정·삭제 시 `revalidateProductListingCaches` 가 /sitemap.xml 도 무효화하고 IndexNow 로 알린다(lib/seo/product-index-events.ts).
 * REGRESSION-FREEZE[seo-sitemap-db-public-only]: DB 공개 상품만, lastmod=updatedAt — manifest
 * REGRESSION-FREEZE[seo-image-sitemap-last-good]: DB 장애·지연 시 상품 URL 이 통째로 빠진 사이트맵 대신 마지막 정상본 — manifest
 */
export const dynamic = 'force-dynamic'

/** freshMs 0 — 삭제·비공개가 바로 반영되도록 항상 재생성하고, 실패·8초 초과일 때만 마지막 정상본 */
const sitemapCache = createLastGoodCache<MetadataRoute.Sitemap>({ freshMs: 0, timeoutMs: 8_000 })

async function loadSitemap(origin: string): Promise<MetadataRoute.Sitemap> {
  const registered = await prisma.product.findMany({
    where: sitemapPublicProductWhere(),
    select: { id: true, slug: true, updatedAt: true },
    take: SITEMAP_PRODUCT_TAKE,
    orderBy: { updatedAt: 'desc' },
  })

  const trainingPrograms = await prisma.product.findMany({
    where: sitemapTrainingProgramWhere(),
    select: { id: true, slug: true, updatedAt: true },
    take: SITEMAP_TRAINING_TAKE,
    orderBy: { updatedAt: 'desc' },
  })

  return buildPublicSitemapEntries({ origin, products: registered, trainingPrograms })
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin()

  if (shouldSkipSitemapDbAtBuild()) {
    return buildPublicSitemapEntries({ origin, products: [], trainingPrograms: [] })
  }

  const { value } = await sitemapCache.get(
    () => loadSitemap(origin),
    () => buildPublicSitemapEntries({ origin, products: [], trainingPrograms: [] }),
  )
  return value
}
