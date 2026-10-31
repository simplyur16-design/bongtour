import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getSiteOrigin } from '@/lib/site-metadata'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { publicProductPath } from '@/lib/product-public-path'
import { OVERSEAS_TRAINING_LISTING_KIND, trainingProgramPublicPath } from '@/lib/overseas-training-program-query'
import { shouldSkipSitemapDbAtBuild } from '@/lib/sitemap-build'

/**
 * 요청 시 DB 조회 — `revalidate` ISR 은 빌드 시점(DB 생략) 정적 결과가 굳어 상품 URL 0건으로 남았다.
 * 상품 URL = 공개 상세와 같은 판정(registered + publicProductWhereClause), slug 우선 주소.
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin()
  const now = new Date()

  const staticPaths = [
    { path: '', priority: 1 },
    { path: '/products', priority: 0.9 },
    { path: '/travel/overseas', priority: 0.85 },
    { path: '/travel/air-hotel', priority: 0.85 },
    { path: '/travel/overseas/private-trip', priority: 0.8 },
    { path: '/travel/esim', priority: 0.85 },
    { path: '/travel/esim/catalog', priority: 0.8 },
    { path: '/travel/esim/recommend', priority: 0.8 },
    { path: '/travel/esim/guide', priority: 0.7 },
    { path: '/travel/esim/devices', priority: 0.7 },
    { path: '/travel/esim/policy', priority: 0.55 },
    { path: '/air-ticketing', priority: 0.8 },
    { path: '/quote/private', priority: 0.75 },
    { path: '/inquiry', priority: 0.75 },
    { path: '/support', priority: 0.75 },
    { path: '/charter-bus', priority: 0.7 },
    { path: '/business', priority: 0.65 },
    { path: '/business/programs', priority: 0.65 },
    { path: '/privacy', priority: 0.4 },
    { path: '/terms', priority: 0.4 },
  ]

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map(({ path, priority }) => ({
    url: path ? `${origin}${path}` : `${origin}/`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority,
  }))

  if (shouldSkipSitemapDbAtBuild()) {
    return staticEntries
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
    return staticEntries
  }

  const productEntries: MetadataRoute.Sitemap = registered.map((p) => ({
    url: `${origin}${publicProductPath(p)}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const trainingEntries: MetadataRoute.Sitemap = trainingPrograms.map((p) => ({
    url: `${origin}${trainingProgramPublicPath(p)}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.65,
  }))

  return [...staticEntries, ...productEntries, ...trainingEntries]
}
