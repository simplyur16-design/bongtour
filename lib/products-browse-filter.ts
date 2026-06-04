/**
 * 상품 목록 browse — 상품유형·목적지 토큰·인당 예산 필터.
 */
import {
  AIR_HOTEL_BROWSE_TYPE,
  inferAirHotelBrowseTypeFromTitle,
  isAirHotelListingKind,
  type AirHotelBrowseType,
} from '@/lib/air-hotel-product-ssot'
import { computeEffectivePricePerPersonKrwFromRow, type ProductPriceSelect } from '@/lib/product-price-per-person'
import {
  productMatchesOverseasDestinationTerms,
  type BrowseUrlGeo,
  type OverseasProductMatchInput,
} from '@/lib/match-overseas-product'
import { parseListingKind, type ListingKind } from '@/lib/product-listing-kind'

export type ProductBrowseType = 'travel' | AirHotelBrowseType

/** DB listingKind → browse 유형 (없으면 null → 제목 추론으로 대체) */
export function browseTypeFromListingKind(kind: string | null | undefined): ProductBrowseType | null {
  const k = parseListingKind(kind ?? undefined)
  if (k == null) return null
  if (k === 'overseas_training') return null
  const map: Record<Exclude<ListingKind, 'overseas_training'>, ProductBrowseType> = {
    travel: 'travel',
    private_trip: 'travel',
    air_hotel_free: AIR_HOTEL_BROWSE_TYPE,
  }
  return map[k]
}

export function inferBrowseType(p: { productType: string | null; title: string }): ProductBrowseType {
  const airHotel = inferAirHotelBrowseTypeFromTitle(p.productType, p.title)
  if (airHotel) return airHotel
  return 'travel'
}

/** listingKind 우선, 없으면 제목·productType 추론 */
export function effectiveBrowseTypeForProduct(p: {
  listingKind?: string | null
  productType: string | null
  title: string
}): ProductBrowseType {
  const fromDb = browseTypeFromListingKind(p.listingKind ?? null)
  if (fromDb != null) return fromDb
  return inferBrowseType({ productType: p.productType, title: p.title })
}

export function productMatchesBrowseType(
  p: { listingKind?: string | null; productType: string | null; title: string },
  type: ProductBrowseType | null,
): boolean {
  if (!type) return true
  const inferred = effectiveBrowseTypeForProduct(p)
  if (type === AIR_HOTEL_BROWSE_TYPE) {
    return inferred === AIR_HOTEL_BROWSE_TYPE || isAirHotelListingKind(p.listingKind)
  }
  return inferred === type
}

export function toOverseasMatchInput(p: {
  title: string
  originSource: string
  primaryDestination: string | null
  destinationRaw: string | null
  destination: string | null
  primaryRegion: string | null
  country?: string | null
  city?: string | null
  countryKey?: string | null
  continentKey?: string | null
  cityKey?: string | null
  countryTags?: OverseasProductMatchInput['countryTags']
  cityTags?: OverseasProductMatchInput['cityTags']
}): OverseasProductMatchInput {
  return {
    title: p.title,
    originSource: p.originSource,
    primaryDestination: p.primaryDestination,
    destinationRaw: p.destinationRaw,
    destination: p.destination,
    primaryRegion: p.primaryRegion,
    country: p.country ?? null,
    city: p.city ?? null,
    countryKey: p.countryKey ?? null,
    continentKey: p.continentKey ?? null,
    cityKey: p.cityKey ?? null,
    countryTags: p.countryTags,
    cityTags: p.cityTags,
  }
}

export type BrowseSort = 'budget_fit' | 'price_asc' | 'price_desc' | 'popular' | 'departure_asc'

/** browse·허브 등 `scoreAndFilterProducts` 입력 — 전체 Product 행 또는 browse select 행 */
export type BrowseScoringProductInput = ProductPriceSelect & {
  id: string
  title: string
  originSource: string
  productType: string | null
  listingKind?: string | null
  primaryDestination: string | null
  destinationRaw: string | null
  destination: string | null
  primaryRegion: string | null
  country?: string | null
  city?: string | null
  countryKey?: string | null
  continentKey?: string | null
  cityKey?: string | null
  countryTags?: OverseasProductMatchInput['countryTags']
  cityTags?: OverseasProductMatchInput['cityTags']
  updatedAt: Date
  nextBookableDepartureAt?: Date | null
  departures?: { departureDate: Date; minPax?: number | null }[]
}

export type BrowseScoredProduct<T extends BrowseScoringProductInput = BrowseScoringProductInput> = {
  product: T
  effectivePricePerPerson: number | null
  distanceToBudget: number
  earliestDeparture: Date | null
}

function earliestDepartureDate(departures: { departureDate: Date }[]): Date | null {
  let min: number | null = null
  for (const d of departures) {
    const t = d.departureDate.getTime()
    if (min == null || t < min) min = t
  }
  return min == null ? null : new Date(min)
}

function earliestBookableDepartureForProduct(p: BrowseScoringProductInput): Date | null {
  if (p.nextBookableDepartureAt) {
    const t = new Date(p.nextBookableDepartureAt)
    if (!Number.isNaN(t.getTime())) return t
  }
  return earliestDepartureDate(p.departures ?? [])
}

export function scoreAndFilterProducts<T extends BrowseScoringProductInput>(
  rows: T[],
  opts: {
    type: ProductBrowseType | null
    destinationTerms: string[]
    budgetPerPersonMax: number | null
    sort: BrowseSort
    urlGeo?: BrowseUrlGeo
  },
): BrowseScoredProduct<T>[] {
  const list: BrowseScoredProduct<T>[] = []
  for (const p of rows) {
    if (!productMatchesBrowseType(p, opts.type)) continue
    if (!productMatchesOverseasDestinationTerms(toOverseasMatchInput(p), opts.destinationTerms, opts.urlGeo)) continue
    const effectivePricePerPerson = computeEffectivePricePerPersonKrwFromRow(p)
    if (opts.budgetPerPersonMax != null) {
      if (effectivePricePerPerson == null || effectivePricePerPerson > opts.budgetPerPersonMax) continue
    }
    const distanceToBudget =
      opts.budgetPerPersonMax != null && effectivePricePerPerson != null
        ? Math.abs(opts.budgetPerPersonMax - effectivePricePerPerson)
        : effectivePricePerPerson ?? 0
    const earliestDeparture = earliestBookableDepartureForProduct(p)
    list.push({ product: p, effectivePricePerPerson, distanceToBudget, earliestDeparture })
  }

  const { sort, budgetPerPersonMax } = opts
  if (sort === 'budget_fit' && budgetPerPersonMax != null) {
    list.sort((a, b) => a.distanceToBudget - b.distanceToBudget)
  } else if (sort === 'price_asc') {
    list.sort((a, b) => (a.effectivePricePerPerson ?? 1e12) - (b.effectivePricePerPerson ?? 1e12))
  } else if (sort === 'price_desc') {
    list.sort((a, b) => (b.effectivePricePerPerson ?? 0) - (a.effectivePricePerPerson ?? 0))
  } else if (sort === 'departure_asc') {
    list.sort((a, b) => {
      const ta = a.earliestDeparture?.getTime() ?? Number.MAX_SAFE_INTEGER
      const tb = b.earliestDeparture?.getTime() ?? Number.MAX_SAFE_INTEGER
      return ta - tb
    })
  } else {
    list.sort((a, b) => new Date(b.product.updatedAt).getTime() - new Date(a.product.updatedAt).getTime())
  }
  return list
}
