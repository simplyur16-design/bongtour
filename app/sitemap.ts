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

/**
 * 요청 시 DB 조회 — `revalidate` ISR 은 빌드 시점(DB 생략) 정적 결과가 굳어 상품 URL 0건으로 남았다.
 * 상품 URL = 공개 상세와 같은 판정(registered + publicProductWhereClause), slug 우선 주소.
 * 등록·수정·삭제 시 `revalidateProductListingCaches` 가 /sitemap.xml 도 무효화하고 IndexNow 로 알린다(lib/seo/product-index-events.ts).
 * REGRESSION-FREEZE[seo-sitemap-db-public-only]: DB 공개 상품만, lastmod=updatedAt — manifest
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin()

  if (shouldSkipSitemapDbAtBuild()) {
    return buildPublicSitemapEntries({ origin, products: [], trainingPrograms: [] })
  }

  let registered: { id: string; slug: string | null; updatedAt: Date }[] = []
  let trainingPrograms: { id: string; slug: string | null; updatedAt: Date }[] = []
  try {
    registered = await prisma.product.findMany({
      where: sitemapPublicProductWhere(),
      select: { id: true, slug: true, updatedAt: true },
      take: SITEMAP_PRODUCT_TAKE,
      orderBy: { updatedAt: 'desc' },
    })

    trainingPrograms = await prisma.product.findMany({
      where: sitemapTrainingProgramWhere(),
      select: { id: true, slug: true, updatedAt: true },
      take: SITEMAP_TRAINING_TAKE,
      orderBy: { updatedAt: 'desc' },
    })
  } catch (e) {
    console.error('[sitemap] DB unavailable — static URLs only', e)
    return buildPublicSitemapEntries({ origin, products: [], trainingPrograms: [] })
  }

  return buildPublicSitemapEntries({ origin, products: registered, trainingPrograms })
}
