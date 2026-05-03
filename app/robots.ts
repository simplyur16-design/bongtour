import type { MetadataRoute } from 'next'
import { getSiteOrigin } from '@/lib/site-metadata'

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/admin/', '/api/'],
    },
    sitemap: [`${origin}/sitemap.xml`, `${origin}/sitemap-images.xml`],
  }
}
