import {
  buildOffersNode,
  buildProductJsonLdData,
  type ProductJsonLdAggregateOffer,
  type ProductJsonLdBreadcrumbItem,
  type ProductJsonLdItineraryItem,
} from '@/lib/seo/product-json-ld'
import { absoluteUrl, toAbsoluteImageUrl } from '@/lib/site-metadata'

export type {
  ProductJsonLdAggregateOffer,
  ProductJsonLdBreadcrumbItem,
  ProductJsonLdItineraryItem,
}
export { buildProductJsonLdData }

type Props = {
  productId: string
  name: string
  description: string
  imageUrl: string | null | undefined
  offers?: ProductJsonLdAggregateOffer | null
  breadcrumbItems?: ProductJsonLdBreadcrumbItem[] | null
  itinerary?: ProductJsonLdItineraryItem[] | null
}

/**
 * 상품 상세: Product(+offers 필수) + 선택적 BreadcrumbList / TouristTrip.
 * REGRESSION-FREEZE[product-jsonld-requires-offers]: omit Product when no offers — manifest
 */
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
  const productData = buildProductJsonLdData({
    productId,
    name,
    description,
    imageUrl,
    offers,
  })

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
          ...(offers && offers.lowPrice > 0 ? { offers: buildOffersNode(offers, url) } : {}),
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
      {productData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productData) }} />
      ) : null}
      {breadcrumbLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      ) : null}
      {touristTripLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(touristTripLd) }} />
      ) : null}
    </>
  )
}
