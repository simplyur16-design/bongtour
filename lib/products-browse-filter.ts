/**
 * 상품 목록 browse — 상품유형·목적지 토큰·인당 예산 필터.
 * 예산: computeEffectivePricePerPersonKrwFromRow 로 산정한 값이 입력 예산 이하인 것만 포함.
 * (등록된 상품의 실제 금액을 확인하여 예산 범위 내 상품만 노출)
 */
import type { Product } from '@prisma/client'
import { computeEffectivePricePerPersonKrwFromRow, type ProductPriceSelect } from '@/lib/product-price-per-person'
import { productMatchesOverseasDestinationTerms, type OverseasProductMatchInput } from '@/lib/match-overseas-product'
import { parseListingKind, type ListingKind } from '@/lib/product-listing-kind'

export type ProductBrowseType = 'travel' | 'free' | 'semi' | 'private' | 'airtel'

/** DB listingKind → browse 유형 (없으면 null → 제목 추론으로 대체) */
export function browseTypeFromListingKind(kind: string | null | undefined): ProductBrowseType | null {
  const k = parseListingKind(kind ?? undefined)
  if (k == null) return null
  const map: Record<ListingKind, ProductBrowseType> = {
    travel: 'travel',
    private_trip: 'private',
    air_hotel_free: 'airtel',
  }
  return map[k] ?? null
}

export function inferBrowseType(p: { productType: string | null; title: string }): ProductBrowseType {
  const hay = `${p.productType ?? ''} ${p.title}`.toLowerCase()
  if (/(에어텔|air[\s-]?tel)/i.test(hay)) return 'airtel'
  if (/(자유여행|자유\s*여행|\bfree\b|항공\s*\+\s*호텔|항공\+호텔)/i.test(hay)) return 'free'
  if (/(세미\s*패키지|세미패키지|semi|준패키지)/i.test(hay)) return 'semi'
  if (/(우리끼리|단독\s*행사|맞춤\s*여행|소그룹)/i.test(hay)) return 'private'
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
  type: ProductBrowseType | null
): boolean {
  if (!type) return true
  const inferred = effectiveBrowseTypeForProduct(p)
  /** 항공+호텔(자유여행) 허브: URL type=airtel 에서 에어텔·항공+호텔·자유여행 키워드 모두 매칭 */
  if (type === 'airtel') return inferred === 'airtel' || inferred === 'free'
  return inferred === type
}

export function toOverseasMatchInput(p: {
  title: string
  originSource: string
  primaryDestination: string | null
  destinationRaw: string | null
  destination: string | null
  primaryRegion: string | null
  continent?: string | null
  country?: string | null
  city?: string | null
}): OverseasProductMatchInput {
  return {
    title: p.title,
    originSource: p.originSource,
    primaryDestination: p.primaryDestination,
    destinationRaw: p.destinationRaw,
    destination: p.destination,
    primaryRegion: p.primaryRegion,
    continent: p.continent ?? null,
    country: p.country ?? null,
    city: p.city ?? null,
  }
}

export type BrowseSort = 'budget_fit' | 'price_asc' | 'price_desc' | 'popular' | 'departure_asc'

export type BrowseScoredProduct = {
  product: Product & ProductPriceSelect
  effectivePricePerPerson: number | null
  distanceToBudget: number
  earliestDeparture: Date | null
}

function earliestDepartureDate(departures: { departureDate: Date }[]): Date | null {
  if (departures.length === 0) return null
  let min = departures[0]!.departureDate.getTime()
  for (let i = 1; i < departures.length; i++) {
    const t = departures[i]!.departureDate.getTime()
    if (t < min) min = t
  }
  return new Date(min)
}

export function scoreAndFilterProducts(
  rows: Array<Product & ProductPriceSelect>,
  opts: {
    type: ProductBrowseType | null
    destinationTerms: string[]
    budgetPerPersonMax: number | null
    sort: BrowseSort
    /** URL `region`·`country`·`city` — DB continent/country/city 슬러그와 직접 비교 */
    urlGeo?: { region: string | null; country: string | null; city: string | null }
  }
): BrowseScoredProduct[] {
  const list: BrowseScoredProduct[] = []
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
    const earliestDeparture = earliestDepartureDate(p.departures)
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
