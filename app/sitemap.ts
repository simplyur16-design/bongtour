import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getSiteOrigin } from '@/lib/site-metadata'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin()
  const now = new Date()

  const staticPaths = [
    { path: '', priority: 1 },
    { path: '/products', priority: 0.9 },
    { path: '/travel/overseas', priority: 0.85 },
    { path: '/travel/domestic', priority: 0.8 },
    { path: '/air-ticketing', priority: 0.8 },
    { path: '/quote/private', priority: 0.75 },
    { path: '/inquiry', priority: 0.75 },
    { path: '/support', priority: 0.75 },
    { path: '/charter-bus', priority: 0.7 },
    { path: '/training', priority: 0.65 },
  ]

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map(({ path, priority }) => ({
    url: path ? `${origin}${path}` : `${origin}/`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority,
  }))

  const registered = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: { id: true, updatedAt: true },
    take: 5000,
    orderBy: { updatedAt: 'desc' },
  })

  const productEntries: MetadataRoute.Sitemap = registered.map((p) => ({
    url: `${origin}/products/${p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticEntries, ...productEntries]
}
