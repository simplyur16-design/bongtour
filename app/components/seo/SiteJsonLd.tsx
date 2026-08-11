import { absoluteUrl, SITE_NAME } from '@/lib/site-metadata'
import { COMPANY_FOOTER } from '@/lib/company-footer'

/** 메인: Organization + WebSite + TravelAgency (홈 전용, @graph) */
export default function SiteJsonLd() {
  const origin = absoluteUrl('/')
  const logoUrl = absoluteUrl('/images/bongtour-logo.webp')
  const phoneForSchema = COMPANY_FOOTER.phoneTel.replace(/^tel:/i, '').trim()
  const emailForSchema = COMPANY_FOOTER.emailHref.replace(/^mailto:/i, '').trim()
  const orgId = `${origin.replace(/\/$/, '')}/#organization`
  const websiteId = `${origin.replace(/\/$/, '')}/#website`
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: SITE_NAME,
        url: origin,
        logo: {
          '@type': 'ImageObject',
          url: logoUrl,
        },
        sameAs: ['https://bongtour.net', 'https://www.instagram.com/bongtour103/'],
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: SITE_NAME,
        url: origin,
        publisher: { '@id': orgId },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin.replace(/\/$/, '')}/products?destination={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'TravelAgency',
        '@id': `${origin.replace(/\/$/, '')}/#travelagency`,
        name: COMPANY_FOOTER.legalName,
        url: origin,
        logo: logoUrl,
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
        parentOrganization: { '@id': orgId },
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
