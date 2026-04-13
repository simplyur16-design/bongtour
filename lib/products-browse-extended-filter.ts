/**
 * browse API 2차 필터 — scoreAndFilterProducts 이후 적용.
 * 예산 상·하한은 등록 상품의 인당 유효가( computeEffectivePricePerPersonKrwFromRow )와 동일 기준.
 *
 * 예산 필터는 등록된 상품의 실제 금액을 확인하여 예산 범위 내 상품만 노출한다.
 */
import { AIRLINE_CATALOG, airlineStringMatchesCode, buildAirlineHaystack } from '@/lib/airline-catalog'
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { effectiveBrowseTypeForProduct } from '@/lib/products-browse-filter'
import { computeEffectivePricePerPersonKrwFromRow } from '@/lib/product-price-per-person'
import type { Product } from '@prisma/client'

export type ProductBrowseFullRow = Product & {
  departures: Array<{
    adultPrice: number | null
    departureDate: Date
    outboundDepartureAt: Date | null
    carrierName: string | null
    isDepartureConfirmed: boolean | null
    statusLabelsRaw: string | null
    statusRaw: string | null
  }>
  prices: { adult: number }[]
  brand: { brandKey: string; displayName: string } | null
  _count: { optionalTours: number }
}

export type ExtendedBrowseFilters = {
  /** 현지옵션 없음 — DB: optionalTours 없음 & hasOptionalTours 아님 */
  noOptionalTour?: boolean
  /** 쇼핑 없음 — shoppingCount·shoppingVisitCountTotal 0 */
  noShopping?: boolean
  /** Brand.brandKey 또는 originSource 정규화 키 (복수 선택 시 OR) */
  brandKeys?: string[]
  /** 에어텔·단독(프라이빗)·프리미엄 (복수 선택 시 OR) — 구 URL category= */
  productCategories?: Array<'airtel' | 'private' | 'premium'>
  /** airline catalog code + 'other' (복수 선택 시 OR) */
  airlineCodes?: string[]
  /** '04-07' … '20-24' — 출발편 outboundDepartureAt 기준 (복수 선택 시 OR) */
  departureHourBuckets?: string[]
  /** 0=일 … 6=토 — 출발일 departureDate 요일 (복수 선택 시 OR) */
  departureWeekdays?: number[]
  /** 인당 최저가 하한(원) — 실제 금액 기준 */
  budgetMin?: number | null
  /** 인당 최저가 상한(원) — 실제 금액 기준; 기존 budgetPerPersonMax와 동일 의미로 병행 */
  budgetMax?: number | null
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

/** @returns 서울 로컬 시각 기준 시(0–23) — 저장값이 UTC일 수 있어 표시용 근사 */
function hourFromDepartureAt(d: Date): number {
  return d.getHours()
}

export function resolveProductBrandKey(p: {
  brand: { brandKey: string } | null
  originSource: string
}): string {
  const fromBrand = normalizeBrandKeyToCanonicalSupplierKey(p.brand?.brandKey ?? null)
  if (fromBrand) return fromBrand
  const k = normalizeSupplierOrigin(p.originSource)
  if (k === 'verygoodtour') return 'verygoodtour'
  if (k === 'ybtour') return 'ybtour'
  if (k === 'etc') return 'other'
  return k
}

function matchesBrandKeys(p: ProductBrowseFullRow, keys: string[]): boolean {
  if (keys.length === 0) return true
  const pk = resolveProductBrandKey(p)
  const pkCanon = normalizeBrandKeyToCanonicalSupplierKey(pk) ?? pk
  return keys.some((req) => {
    const reqCanon = normalizeBrandKeyToCanonicalSupplierKey(req) ?? req
    if (reqCanon === pkCanon) return true
    return false
  })
}

function matchesProductCategories(p: ProductBrowseFullRow, cats: Array<'airtel' | 'private' | 'premium'>): boolean {
  if (cats.length === 0) return true
  const inferred = effectiveBrowseTypeForProduct(p)
  return cats.some((c) => {
    if (c === 'airtel') return inferred === 'airtel' || inferred === 'free'
    if (c === 'private') return inferred === 'private'
    if (c === 'premium') {
      const t = `${p.title} ${p.productType ?? ''}`.toLowerCase()
      return /프리미엄|premium|품격|특급|프리미엄\s*패키지/i.test(t)
    }
    return false
  })
}

function matchesAirlineCodes(p: ProductBrowseFullRow, codes: string[]): boolean {
  if (codes.length === 0) return true
  const parts: string[] = []
  if (p.airline) parts.push(p.airline)
  for (const d of p.departures) {
    if (d.carrierName) parts.push(d.carrierName)
  }
  const hay = buildAirlineHaystack(parts)
  return codes.some((code) => {
    if (code === 'other') {
      if (!hay.trim()) return false
      const matchesKnown = AIRLINE_CATALOG.some((e) => airlineStringMatchesCode(hay, e.code))
      return !matchesKnown
    }
    return airlineStringMatchesCode(hay, code)
  })
}

function matchesOptionalTourNone(p: ProductBrowseFullRow): boolean {
  const hasRow = p.hasOptionalTours === true
  const count = p._count.optionalTours
  if (hasRow) return false
  if (count > 0) return false
  return true
}

function matchesShoppingNone(p: ProductBrowseFullRow): boolean {
  const sc = p.shoppingCount
  const sv = p.shoppingVisitCountTotal
  const shoppingVisits = sc != null && sc > 0
  const visitTotal = sv != null && sv > 0
  return !shoppingVisits && !visitTotal
}

function matchesDepartureHourBuckets(p: ProductBrowseFullRow, buckets: string[]): boolean {
  if (buckets.length === 0) return true
  return p.departures.some((d: ProductBrowseFullRow['departures'][number]) => {
    if (!d.outboundDepartureAt) return false
    const h = hourFromDepartureAt(new Date(d.outboundDepartureAt))
    return buckets.some((b) => hourInBucket(h, b))
  })
}

function matchesDepartureWeekdays(p: ProductBrowseFullRow, weekdays: number[]): boolean {
  if (weekdays.length === 0) return true
  return p.departures.some((d: ProductBrowseFullRow['departures'][number]) => {
    const day = new Date(d.departureDate).getDay()
    return weekdays.includes(day)
  })
}

/**
 * 2차 필터 — `budgetMin`/`budgetMax`는 인당 유효가( priceFrom / 출발가 / 레거시가 중 최소 ) 기준.
 */
export function productRowPassesExtendedFilters(row: ProductBrowseFullRow, f: ExtendedBrowseFilters): boolean {
  const price = computeEffectivePricePerPersonKrwFromRow(row)

  if (f.budgetMin != null && f.budgetMin > 0) {
    if (price == null || price < f.budgetMin) return false
  }
  if (f.budgetMax != null && f.budgetMax > 0) {
    if (price == null || price > f.budgetMax) return false
  }

  if (f.noOptionalTour && !matchesOptionalTourNone(row)) return false
  if (f.noShopping && !matchesShoppingNone(row)) return false

  if (f.brandKeys && f.brandKeys.length > 0 && !matchesBrandKeys(row, f.brandKeys)) return false
  if (f.productCategories && f.productCategories.length > 0 && !matchesProductCategories(row, f.productCategories))
    return false
  if (f.airlineCodes && f.airlineCodes.length > 0 && !matchesAirlineCodes(row, f.airlineCodes)) return false
  if (f.departureHourBuckets && f.departureHourBuckets.length > 0) {
    if (!matchesDepartureHourBuckets(row, f.departureHourBuckets)) return false
  }
  if (f.departureWeekdays && f.departureWeekdays.length > 0) {
    if (!matchesDepartureWeekdays(row, f.departureWeekdays)) return false
  }

  return true
}

export function computeFacetFlags(rows: ProductBrowseFullRow[]): {
  hasDepartureTimeData: boolean
  hasWeekdayData: boolean
} {
  let hasDepartureTimeData = false
  let hasWeekdayData = false
  for (const p of rows) {
    for (const d of p.departures) {
      hasWeekdayData = true
      if (d.outboundDepartureAt) {
        hasDepartureTimeData = true
        break
      }
    }
    if (hasDepartureTimeData) break
  }
  return { hasDepartureTimeData, hasWeekdayData }
}
