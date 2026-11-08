import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getSiteOrigin } from '@/lib/site-metadata'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { OVERSEAS_TRAINING_LISTING_KIND } from '@/lib/overseas-training-program-query'
import { shouldSkipSitemapDbAtBuild } from '@/lib/sitemap-build'
import { buildPublicSitemapEntries } from '@/lib/sitemap-public-entries'

/**
 * 요청 시 DB 조회 — `revalidate` ISR 은 빌드 시점(DB 생략) 정적 결과가 굳어 상품 URL 0건으로 남았다.
 * 상품 URL = 공개 상세와 같은 판정(registered + publicProductWhereClause), slug 우선 주소.
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
      where: {
        registrationStatus: 'registered',
        AND: [
          publicProductWhereClause(),
          // 연수 프로그램은 /business/programs 주소로 따로 — listingKind NULL 상품은 포함(SQL NOT 의 NULL 제외 방지)
          { OR: [{ listingKind: null }, { NOT: { listingKind: OVERSEAS_TRAINING_LISTING_KIND } }] },
        ],
      },
      select: { id: true, slug: true, updatedAt: true },
      take: 5000,
      orderBy: { updatedAt: 'desc' },
    })

    trainingPrograms = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        listingKind: OVERSEAS_TRAINING_LISTING_KIND,
      },
      select: { id: true, slug: true, updatedAt: true },
      take: 500,
      orderBy: { updatedAt: 'desc' },
    })
  } catch (e) {
    console.error('[sitemap] DB unavailable — static URLs only', e)
    return buildPublicSitemapEntries({ origin, products: [], trainingPrograms: [] })
  }

  return buildPublicSitemapEntries({ origin, products: registered, trainingPrograms })
}
