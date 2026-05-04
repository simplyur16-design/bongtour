import { absoluteUrl, SITE_NAME, toAbsoluteImageUrl } from '@/lib/site-metadata'

export type ProductJsonLdAggregateOffer = {
  lowPrice: number
  highPrice: number
  offerCount: number
  availability: 'InStock' | 'LimitedAvailability' | 'SoldOut' | 'OutOfStock'
  validFrom?: string
  priceValidUntil?: string
}

export type ProductJsonLdBreadcrumbItem = {
  position: number
  name: string
  item?: string
}

export type ProductJsonLdItineraryItem = {
  dayNumber: number
  title: string
  city?: string | null
}

type Props = {
  productId: string
  name: string
  description: string
  imageUrl: string | null | undefined
  offers?: ProductJsonLdAggregateOffer | null
  breadcrumbItems?: ProductJsonLdBreadcrumbItem[] | null
  itinerary?: ProductJsonLdItineraryItem[] | null
}

/** 상품 상세: Product + 선택적 AggregateOffer / BreadcrumbList (Rich Snippet용) */
export default function ProductJsonLd({
  productId,
  name,
  description,
  imageUrl,
  offers = null,
  breadcrumbItems = null,
  itinerary = null,
}: Props) {
  const url = absoluteUrl(`/products/${productId}`)
  const img = toAbsoluteImageUrl(imageUrl)
  const productData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url,
    ...(img ? { image: [img] } : {}),
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
    ...(offers
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'KRW',
            lowPrice: offers.lowPrice,
            highPrice: offers.highPrice,
            offerCount: offers.offerCount,
            availability: `https://schema.org/${offers.availability}`,
            ...(offers.validFrom ? { validFrom: offers.validFrom } : {}),
            ...(offers.priceValidUntil ? { priceValidUntil: offers.priceValidUntil } : {}),
            url,
            seller: {
              '@type': 'TravelAgency',
              name: SITE_NAME,
            },
          },
        }
      : {}),
  }

  const breadcrumbLd =
    breadcrumbItems && breadcrumbItems.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbItems.map((it) => ({
            '@type': 'ListItem',
            position: it.position,
            name: it.name,
            ...(it.item ? { item: it.item } : {}),
          })),
        }
      : null

  const touristTripLd =
    itinerary && itinerary.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'TouristTrip',
          name,
          description,
          url,
          ...(img ? { image: [img] } : {}),
          ...(offers
            ? {
                offers: {
                  '@type': 'AggregateOffer',
                  priceCurrency: 'KRW',
                  lowPrice: offers.lowPrice,
                  highPrice: offers.highPrice,
                  offerCount: offers.offerCount,
                  availability: `https://schema.org/${offers.availability}`,
                  ...(offers.validFrom ? { validFrom: offers.validFrom } : {}),
                  ...(offers.priceValidUntil ? { priceValidUntil: offers.priceValidUntil } : {}),
                },
              }
            : {}),
          itinerary: {
            '@type': 'ItemList',
            itemListElement: itinerary.map((day) => {
              const city = (day.city ?? '').trim()
              return {
                '@type': 'ListItem',
                position: day.dayNumber,
                item: {
                  '@type': 'TouristAttraction',
                  name: day.title,
                  ...(city
                    ? {
                        address: {
                          '@type': 'PostalAddress',
                          addressLocality: city,
                        },
                      }
                    : {}),
                },
              }
            }),
          },
        }
      : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productData) }} />
      {breadcrumbLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      ) : null}
      {touristTripLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(touristTripLd) }} />
      ) : null}
    </>
  )
}
