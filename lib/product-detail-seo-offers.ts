import type { ProductJsonLdAggregateOffer } from '@/app/components/seo/ProductJsonLd'

type DepartureForSeoOffers = {
  adultPrice: number | null
  departureDate: Date
  statusRaw?: string | null
  seatsStatusRaw?: string | null
}

function isUnavailableDeparture(d: DepartureForSeoOffers): boolean {
  const sold = (d.statusRaw ?? '').includes('마감') || (d.seatsStatusRaw ?? '').includes('마감')
  return sold
}

const formatYmd = (d: Date) => d.toISOString().slice(0, 10)

export function buildProductDetailSeoOffers(
  departures: readonly DepartureForSeoOffers[],
  resolvedPriceFrom: number | null
): ProductJsonLdAggregateOffer | null {
  const pricedDepartures = departures.filter((d) => d.adultPrice != null && d.adultPrice > 0)
  const unavailableCount = departures.filter(isUnavailableDeparture).length
  const totalCount = departures.length

  if (pricedDepartures.length > 0) {
    const prices = pricedDepartures.map((d) => d.adultPrice as number)
    const dates = pricedDepartures.map((d) => d.departureDate).sort((a, b) => +a - +b)

    let availability: 'InStock' | 'LimitedAvailability' | 'SoldOut' = 'InStock'
    if (totalCount > 0 && unavailableCount === totalCount) availability = 'SoldOut'
    else if (totalCount > 0 && unavailableCount * 2 >= totalCount) availability = 'LimitedAvailability'

    return {
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: pricedDepartures.length,
      availability,
      validFrom: formatYmd(dates[0]),
      priceValidUntil: formatYmd(dates[dates.length - 1]),
    }
  }

  if (resolvedPriceFrom != null && resolvedPriceFrom > 0) {
    return {
      lowPrice: resolvedPriceFrom,
      highPrice: resolvedPriceFrom,
      offerCount: 0,
      availability: 'OutOfStock',
    }
  }

  return null
}
