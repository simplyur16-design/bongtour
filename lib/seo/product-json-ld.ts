/**
 * Product JSON-LD builders (no JSX) — Google Product rich results require offers.
 * REGRESSION-FREEZE[product-jsonld-requires-offers]: no bare Product without offers — manifest
 */
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

export function buildOffersNode(
  offers: ProductJsonLdAggregateOffer,
  productUrl: string,
): Record<string, unknown> {
  const availability = `https://schema.org/${offers.availability}`
  const common = {
    priceCurrency: 'KRW',
    availability,
    ...(offers.validFrom ? { validFrom: offers.validFrom } : {}),
    ...(offers.priceValidUntil ? { priceValidUntil: offers.priceValidUntil } : {}),
    url: productUrl,
    seller: {
      '@type': 'TravelAgency',
      name: SITE_NAME,
    },
  } as const

  // offerCount 0 AggregateOffer is invalid — emit a single Offer from list price.
  if (offers.offerCount <= 0) {
    return {
      '@type': 'Offer',
      ...common,
      price: offers.lowPrice,
    }
  }

  return {
    '@type': 'AggregateOffer',
    ...common,
    lowPrice: offers.lowPrice,
    highPrice: offers.highPrice,
    offerCount: offers.offerCount,
  }
}

/** Build Product JSON-LD only when a valid offer exists. */
export function buildProductJsonLdData(input: {
  productId: string
  name: string
  description: string
  imageUrl: string | null | undefined
  offers: ProductJsonLdAggregateOffer | null | undefined
}): Record<string, unknown> | null {
  if (!input.offers) return null
  if (!(input.offers.lowPrice > 0) || !(input.offers.highPrice > 0)) return null

  const url = absoluteUrl(`/products/${input.productId}`)
  const img = toAbsoluteImageUrl(input.imageUrl)
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    url,
    ...(img ? { image: [img] } : {}),
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
    offers: buildOffersNode(input.offers, url),
  }
}
