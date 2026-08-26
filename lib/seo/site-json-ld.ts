/**
 * 홈 Organization + WebSite + TravelAgency JSON-LD.
 * REGRESSION-FREEZE[home-seo-travel-index]: 여행 검색용 스키마 — manifest
 */
import { absoluteUrl, SITE_NAME } from '@/lib/site-metadata'
import { COMPANY_FOOTER } from '@/lib/company-footer'
import {
  HOME_PAGE_DESCRIPTION,
  HOME_PAGE_TITLE,
} from '@/lib/home-page-metadata'

export function buildSiteJsonLdGraph(): Record<string, unknown> {
  const origin = absoluteUrl('/')
  const originNoSlash = origin.replace(/\/$/, '')
  const logoUrl = absoluteUrl('/images/bongtour-logo.webp')
  const phoneForSchema = COMPANY_FOOTER.phoneTel.replace(/^tel:/i, '').trim()
  const emailForSchema = COMPANY_FOOTER.emailHref.replace(/^mailto:/i, '').trim()
  const orgId = `${originNoSlash}/#organization`
  const websiteId = `${originNoSlash}/#website`
  const webpageId = `${originNoSlash}/#webpage`
  const agencyId = `${originNoSlash}/#travelagency`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: SITE_NAME,
        alternateName: ['봉투어', 'Bong투어', 'BongTour', 'Bong Tour'],
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
        alternateName: ['봉투어', 'Bong투어'],
        url: origin,
        inLanguage: 'ko-KR',
        description: HOME_PAGE_DESCRIPTION,
        publisher: { '@id': orgId },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${originNoSlash}/products?destination={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'WebPage',
        '@id': webpageId,
        url: origin,
        name: HOME_PAGE_TITLE,
        description: HOME_PAGE_DESCRIPTION,
        inLanguage: 'ko-KR',
        isPartOf: { '@id': websiteId },
        about: ['해외여행', '패키지여행', '자유여행', 'eSIM'],
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: logoUrl,
        },
      },
      {
        '@type': 'TravelAgency',
        '@id': agencyId,
        name: COMPANY_FOOTER.legalName,
        alternateName: ['봉투어', SITE_NAME],
        url: origin,
        logo: logoUrl,
        description: HOME_PAGE_DESCRIPTION,
        knowsAbout: ['해외여행 패키지', '자유여행', '항공호텔', '해외 eSIM', '우리끼리 여행'],
        areaServed: { '@type': 'Country', name: 'KR' },
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
        parentOrganization: { '@id': orgId },
      },
      {
        '@type': 'ItemList',
        '@id': `${originNoSlash}/#travel-services`,
        name: '봉투어 여행 서비스',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: '해외여행 패키지',
            url: `${originNoSlash}/travel/overseas`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: '자유여행 항공+호텔',
            url: `${originNoSlash}/travel/air-hotel`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: '해외여행 eSIM',
            url: `${originNoSlash}/travel/esim`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: '우리끼리 여행',
            url: `${originNoSlash}/travel/overseas/private-trip`,
          },
        ],
      },
    ],
  }
}
