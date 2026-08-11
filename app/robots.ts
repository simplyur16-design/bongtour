import type { MetadataRoute } from 'next'
import { getSiteOrigin } from '@/lib/site-metadata'

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/admin/',
        '/api/',
        '/mypage',
        '/mypage/',
        '/auth',
        '/auth/',
        '/preview',
        '/preview/',
        '/travel/esim/checkout',
        '/travel/esim/checkout/',
        '/travel/esim/order',
        '/travel/esim/order/',
        '/simplyur/',
      ],
    },
    sitemap: [`${origin}/sitemap.xml`, `${origin}/sitemap-images.xml`],
  }
}
