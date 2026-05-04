import { absoluteUrl, SITE_NAME } from '@/lib/site-metadata'
import { COMPANY_FOOTER } from '@/lib/company-footer'

/** 메인: Organization + WebSite + TravelAgency (홈 전용, @graph) */
export default function SiteJsonLd() {
  const origin = absoluteUrl('/')
  const logo = absoluteUrl('/images/bongtour-logo.webp')
  const phoneForSchema = COMPANY_FOOTER.phoneTel.replace(/^tel:/i, '').trim()
  const emailForSchema = COMPANY_FOOTER.emailHref.replace(/^mailto:/i, '').trim()
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
      {
        '@type': 'TravelAgency',
        name: COMPANY_FOOTER.legalName,
        url: origin,
        logo,
        ...(COMPANY_FOOTER.addressLine.trim()
          ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: COMPANY_FOOTER.addressLine,
                addressCountry: 'KR',
              },
            }
          : {}),
        ...(phoneForSchema ? { telephone: phoneForSchema } : {}),
        ...(emailForSchema ? { email: emailForSchema } : {}),
        areaServed: 'KR',
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
