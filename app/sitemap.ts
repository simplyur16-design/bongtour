import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getSiteOrigin } from '@/lib/site-metadata'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { publicProductPath } from '@/lib/product-public-path'
import { OVERSEAS_TRAINING_LISTING_KIND, trainingProgramPublicPath } from '@/lib/overseas-training-program-query'
import { shouldSkipSitemapDbAtBuild } from '@/lib/sitemap-build'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin()
  const now = new Date()

  const staticPaths = [
    { path: '', priority: 1 },
    { path: '/products', priority: 0.9 },
    { path: '/travel/overseas', priority: 0.85 },
    { path: '/air-ticketing', priority: 0.8 },
    { path: '/quote/private', priority: 0.75 },
    { path: '/inquiry', priority: 0.75 },
    { path: '/support', priority: 0.75 },
    { path: '/charter-bus', priority: 0.7 },
    { path: '/business', priority: 0.65 },
    { path: '/business/programs', priority: 0.65 },
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
        travelScope: 'overseas',
        AND: [publicProductWhereClause()],
        NOT: { listingKind: OVERSEAS_TRAINING_LISTING_KIND },
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
