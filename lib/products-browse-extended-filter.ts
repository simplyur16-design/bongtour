/**
 * browse API 2차 필터 — scoreAndFilterProducts 이후 적용.
 * 예산 상·하한은 등록 상품의 인당 유효가( computeEffectivePricePerPersonKrwFromRow )와 동일 기준.
 *
 * 예산 필터는 등록된 상품의 실제 금액을 확인하여 예산 범위 내 상품만 노출한다.
 */
import { AIRLINE_CATALOG, airlineStringMatchesCode, buildAirlineHaystack } from '@/lib/airline-catalog'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { effectiveBrowseTypeForProduct } from '@/lib/products-browse-filter'
import type { CompanionFilter, TravelGradeFilter } from '@/lib/products-browse-query'
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
  departureConfirmed?: boolean
  /** 현지옵션 없음 — DB: optionalTours 없음 & hasOptionalTours 아님 */
  noOptionalTour?: boolean
  /** 쇼핑 없음 — shoppingCount·shoppingVisitCountTotal 0 */
  noShopping?: boolean
  /** 자유일정 포함 — 상품명·유형·포함내역 휴리스틱 */
  freeScheduleIncluded?: boolean
  /** Brand.brandKey 또는 originSource 정규화 키 (복수 선택 시 OR) */
  brandKeys?: string[]
  /** 에어텔·단독(프라이빗)·프리미엄 (복수 선택 시 OR) — 구 URL category= */
  productCategories?: Array<'airtel' | 'private' | 'premium'>
  /** 사용자 관점 여행 등급 (복수 선택 시 OR) — 제목·유형·포함내역 휴리스틱 */
  travelGrades?: TravelGradeFilter[]
  /** 동행자 (복수 선택 시 OR) */
  companions?: CompanionFilter[]
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

function parseStatusLabelsJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return []
    return j.map((x) => String(x))
  } catch {
    return []
  }
}

function departureIsConfirmed(d: ProductBrowseFullRow['departures'][0]): boolean {
  if (d.isDepartureConfirmed === true) return true
  const labels = parseStatusLabelsJson(d.statusLabelsRaw)
  if (labels.some((s) => /출발\s*확정|출발확정/.test(s))) return true
  const raw = `${d.statusRaw ?? ''}`
  return /출발\s*확정|출발확정/.test(raw)
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
  if (p.brand?.brandKey) return p.brand.brandKey
  const k = normalizeSupplierOrigin(p.originSource)
  if (k === 'verygoodtour') return 'verygoodtour'
  if (k === 'ybtour') return 'ybtour'
  if (k === 'etc') return 'other'
  return k
}

function matchesBrandKeys(p: ProductBrowseFullRow, keys: string[]): boolean {
  if (keys.length === 0) return true
  const pk = resolveProductBrandKey(p)
  return keys.some((req) => {
    if (req === pk) return true
    if (req === 'verygoodtour' && pk === 'verygoodtour') return true
    if ((req === 'yellowballoon' || req === 'ybtour') && (pk === 'yellowballoon' || pk === 'ybtour')) return true
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

function browseHaystack(p: ProductBrowseFullRow): string {
  return `${p.title} ${p.productType ?? ''} ${p.includedText ?? ''}`.toLowerCase()
}

/** 봉투어 좌측 필터 — 상품 메타에 전용 필드가 없을 때 제목·포함문구 기준 탐색용 매칭 */
function matchesTravelGrades(p: ProductBrowseFullRow, grades: TravelGradeFilter[]): boolean {
  if (grades.length === 0) return true
  const hay = browseHaystack(p)
  return grades.some((g) => {
    if (g === 'value') {
      return /가성비|알뜰|특가|이코노미|저렴|합리|가격\s*부담|베스트\s*가|이벤트\s*가|초특가|극\s*가성비/i.test(hay)
    }
    if (g === 'standard') {
      return /스탠다드|\bstandard\b|일반\s*패키지|정통|대표\s*일정|클래식|일반\s*일정|기본\s*구성/i.test(hay)
    }
    if (g === 'premium') {
      return /프리미엄|premium|품격|럭셔리|특급|최상급|5\s*성급|그랜드|럭셔리/i.test(hay)
    }
    return false
  })
}

function matchesCompanions(p: ProductBrowseFullRow, comps: CompanionFilter[]): boolean {
  if (comps.length === 0) return true
  const hay = browseHaystack(p)
  return comps.some((c) => {
    if (c === 'kids') return /아이|어린이|유아|키즈|가족|육아|자녀|초등|패밀리|키즈\s*친화/i.test(hay)
    if (c === 'parents') return /부모|부모님|효도|효여|어르신|시니어|60대|65세|노후/i.test(hay)
    if (c === 'couple') return /커플|부부|신혼|허니문|2인\s*기준|둘이|둘만|듀오|2\s*인\s*전용/i.test(hay)
    if (c === 'friends') return /친구|동창|우정|동호회|모임|동료|같이\s*가|함께\s*떠나/i.test(hay)
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

function matchesFreeSchedule(p: ProductBrowseFullRow): boolean {
  const hay = `${p.title} ${p.productType ?? ''} ${p.includedText ?? ''}`.toLowerCase()
  return /자유\s*일정|일정\s*일부|반일\s*자유|자유\s*관광|free\s*day|일정\s*중\s*자유/i.test(hay)
}

function matchesDepartureConfirmed(p: ProductBrowseFullRow): boolean {
  return p.departures.some((d) => departureIsConfirmed(d))
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

  if (f.departureConfirmed && !matchesDepartureConfirmed(row)) return false
  if (f.noOptionalTour && !matchesOptionalTourNone(row)) return false
  if (f.noShopping && !matchesShoppingNone(row)) return false
  if (f.freeScheduleIncluded && !matchesFreeSchedule(row)) return false

  if (f.brandKeys && f.brandKeys.length > 0 && !matchesBrandKeys(row, f.brandKeys)) return false
  if (f.productCategories && f.productCategories.length > 0 && !matchesProductCategories(row, f.productCategories))
    return false
  if (f.travelGrades && f.travelGrades.length > 0 && !matchesTravelGrades(row, f.travelGrades)) return false
  if (f.companions && f.companions.length > 0 && !matchesCompanions(row, f.companions)) return false
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
