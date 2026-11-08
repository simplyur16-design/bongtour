import type { MetadataRoute } from 'next'
import { publicProductPath } from '@/lib/product-public-path'
import { trainingProgramPublicPath } from '@/lib/overseas-training-program-query'

export const SITEMAP_ESIM_HELP_PATHS = [
  '/travel/esim/help/setup-guide',
  '/travel/esim/help/service-help',
  '/travel/esim/help/device-compatibility',
  '/travel/esim/help/customer-support',
] as const

const SITEMAP_STATIC_CORE: Array<{ path: string; priority: number }> = [
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

export function sitemapStaticPaths(): Array<{ path: string; priority: number }> {
  return [
    ...SITEMAP_STATIC_CORE,
    ...SITEMAP_ESIM_HELP_PATHS.map((path) => ({ path, priority: 0.45 })),
  ]
}

export function latestContentUpdatedAt(dates: Array<Date | null | undefined>): Date | undefined {
  let max = Number.NEGATIVE_INFINITY
  for (const date of dates) {
    const time = date instanceof Date ? date.getTime() : Number.NaN
    if (Number.isFinite(time) && time > max) max = time
  }
  return Number.isFinite(max) ? new Date(max) : undefined
}

type SitemapProduct = { id: string; slug: string | null; updatedAt: Date }

/** 정적 URL lastmod는 상품 updatedAt의 최신값만. 요청 시각은 쓰지 않는다. */
// REGRESSION-FREEZE[seo-design-public-fixes]: sitemap lastmod — manifest
export function buildPublicSitemapEntries(input: {
  origin: string
  products: SitemapProduct[]
  trainingPrograms: SitemapProduct[]
}): MetadataRoute.Sitemap {
  const origin = input.origin.replace(/\/$/, '')
  const contentUpdatedAt = latestContentUpdatedAt([
    ...input.products.map((p) => p.updatedAt),
    ...input.trainingPrograms.map((p) => p.updatedAt),
  ])
  const staticEntries: MetadataRoute.Sitemap = sitemapStaticPaths().map(({ path, priority }) => ({
    url: path ? `${origin}${path}` : `${origin}/`,
    ...(contentUpdatedAt ? { lastModified: contentUpdatedAt } : {}),
    changeFrequency: 'weekly',
    priority,
  }))
  const productEntries: MetadataRoute.Sitemap = input.products.map((p) => ({
    url: `${origin}${publicProductPath(p)}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))
  const trainingEntries: MetadataRoute.Sitemap = input.trainingPrograms.map((p) => ({
    url: `${origin}${trainingProgramPublicPath(p)}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.65,
  }))
  return [...staticEntries, ...productEntries, ...trainingEntries]
}
