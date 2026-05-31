/**
 * 해외·항공+호텔 허브: sidebar 필터는 URL·캐시 키와 분리하고 클라이언트에서 적용.
 */
import { AIRLINE_CATALOG, airlineStringMatchesCode, buildAirlineHaystack } from '@/lib/airline-catalog'
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import {
  resolveProductBrandKey,
  type ProductBrowseFullRow,
} from '@/lib/products-browse-extended-filter'
import type { BrowseSort } from '@/lib/products-browse-filter'
import type { BrowseQueryState } from '@/lib/products-browse-query'
import type { ResultItem } from '@/components/products/ProductResultsList'

export type BrowseItemFilterMeta = {
  brandKey: string
  airlineHaystack: string
  hasOptionalTour: boolean
  hasShopping: boolean
  departureHours: number[]
  departureWeekdays: number[]
}

export type BrowseResultItemWithMeta = ResultItem & {
  browseFilterMeta?: BrowseItemFilterMeta
  earliestDeparture?: string | null
}

const HOUR_BUCKETS: Record<string, [number, number]> = {
  '04-07': [4, 7],
  '07-11': [7, 11],
  '11-14': [11, 14],
  '14-16': [14, 16],
  '16-20': [16, 20],
  '20-24': [20, 24],
}

function hourInBucket(hour: number, bucket: string): boolean {
  const r = HOUR_BUCKETS[bucket]
  if (!r) return false
  const [a, b] = r
  if (bucket === '20-24') return hour >= 20 && hour <= 23
  return hour >= a && hour < b
}

export function buildBrowseItemFilterMeta(p: ProductBrowseFullRow): BrowseItemFilterMeta {
  const parts: string[] = []
  if (p.airline) parts.push(p.airline)
  for (const d of p.departures) {
    if (d.carrierName) parts.push(d.carrierName)
  }
  const departureHours: number[] = []
  const departureWeekdays: number[] = []
  for (const d of p.departures) {
    const day = new Date(d.departureDate).getDay()
    if (!departureWeekdays.includes(day)) departureWeekdays.push(day)
    if (d.outboundDepartureAt) {
      const h = new Date(d.outboundDepartureAt).getHours()
      if (!departureHours.includes(h)) departureHours.push(h)
    }
  }
  return {
    brandKey: resolveProductBrandKey(p),
    airlineHaystack: buildAirlineHaystack(parts),
    hasOptionalTour: p.hasOptionalTours === true,
    hasShopping: (p.shoppingCount ?? 0) > 0 || (p.shoppingVisitCountTotal ?? 0) > 0,
    departureHours,
    departureWeekdays,
  }
}

function matchesBrandKeys(meta: BrowseItemFilterMeta, keys: string[]): boolean {
  if (keys.length === 0) return true
  const pkCanon = normalizeBrandKeyToCanonicalSupplierKey(meta.brandKey) ?? meta.brandKey
  return keys.some((req) => {
    const reqCanon = normalizeBrandKeyToCanonicalSupplierKey(req) ?? req
    return reqCanon === pkCanon
  })
}

function matchesAirlineCodes(meta: BrowseItemFilterMeta, codes: string[]): boolean {
  if (codes.length === 0) return true
  const hay = meta.airlineHaystack
  return codes.some((code) => {
    if (code === 'other') {
      if (!hay.trim()) return false
      const matchesKnown = AIRLINE_CATALOG.some((e) => airlineStringMatchesCode(hay, e.code))
      return !matchesKnown
    }
    return airlineStringMatchesCode(hay, code)
  })
}

function matchesDepartureHourBuckets(meta: BrowseItemFilterMeta, buckets: string[]): boolean {
  if (buckets.length === 0) return true
  return meta.departureHours.some((h) => buckets.some((b) => hourInBucket(h, b)))
}

function matchesDepartureWeekdays(meta: BrowseItemFilterMeta, weekdays: number[]): boolean {
  if (weekdays.length === 0) return true
  return meta.departureWeekdays.some((d) => weekdays.includes(d))
}

export function browseItemPassesSidebarFilters(item: BrowseResultItemWithMeta, q: BrowseQueryState): boolean {
  const meta = item.browseFilterMeta
  const price = item.effectivePricePerPersonKrw

  if (q.budgetMin != null && q.budgetMin > 0) {
    if (price == null || price < q.budgetMin) return false
  }
  if (q.budgetPerPerson != null && q.budgetPerPerson > 0) {
    if (price == null || price > q.budgetPerPerson) return false
  }

  if (q.noOptionalTour && meta?.hasOptionalTour) return false
  if (q.noShopping && meta?.hasShopping) return false

  if (q.brands.length > 0) {
    if (!meta || !matchesBrandKeys(meta, q.brands)) return false
  }
  if (q.airlines.length > 0) {
    if (!meta || !matchesAirlineCodes(meta, q.airlines)) return false
  }
  if (q.departHours.length > 0) {
    if (!meta || !matchesDepartureHourBuckets(meta, q.departHours)) return false
  }
  if (q.departWeekdays.length > 0) {
    if (!meta || !matchesDepartureWeekdays(meta, q.departWeekdays)) return false
  }

  return true
}

export function filterBrowseItemsBySidebarFilters(
  items: BrowseResultItemWithMeta[],
  q: BrowseQueryState,
): BrowseResultItemWithMeta[] {
  return items.filter((item) => browseItemPassesSidebarFilters(item, q))
}

export function sortBrowseItemsClient(
  items: BrowseResultItemWithMeta[],
  sort: BrowseSort,
  budgetPerPersonMax: number | null,
): BrowseResultItemWithMeta[] {
  const list = [...items]
  if (sort === 'budget_fit' && budgetPerPersonMax != null) {
    list.sort((a, b) => {
      const pa = a.effectivePricePerPersonKrw
      const pb = b.effectivePricePerPersonKrw
      const da = pa != null ? Math.abs(budgetPerPersonMax - pa) : Number.MAX_SAFE_INTEGER
      const db = pb != null ? Math.abs(budgetPerPersonMax - pb) : Number.MAX_SAFE_INTEGER
      return da - db
    })
  } else if (sort === 'price_asc') {
    list.sort((a, b) => (a.effectivePricePerPersonKrw ?? 1e12) - (b.effectivePricePerPersonKrw ?? 1e12))
  } else if (sort === 'price_desc') {
    list.sort((a, b) => (b.effectivePricePerPersonKrw ?? 0) - (a.effectivePricePerPersonKrw ?? 0))
  } else if (sort === 'departure_asc') {
    list.sort((a, b) => {
      const ta = a.earliestDeparture ? new Date(a.earliestDeparture).getTime() : Number.MAX_SAFE_INTEGER
      const tb = b.earliestDeparture ? new Date(b.earliestDeparture).getTime() : Number.MAX_SAFE_INTEGER
      return ta - tb
    })
  }
  return list
}
