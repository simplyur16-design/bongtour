import { absoluteUrl, SITE_NAME } from '@/lib/site-metadata'

/** 메인: Organization + WebSite (최소) */
export default function SiteJsonLd() {
  const origin = absoluteUrl('/')
  const logo = absoluteUrl('/images/bongtour-logo.png')
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: SITE_NAME,
        url: origin,
        logo,
      },
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: origin,
      },
    ],
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
