/**
 * 인당 가격 산정 — 예산 필터·목록 정렬·카드 표시용.
 *
 * 출발행(ProductDeparture)에 반영된 금액이 있으면 **그 최저만** 사용한다.
 * (오래된 priceFrom 대표가가 목록 최저가를 오염시키지 않도록 함)
 *
 * 출발행이 없거나 전부 null/0이면
 * minBookableAdultPrice → priceFrom → ProductPrice.adult 최저 폴백.
 * REGRESSION-FREEZE[browse-price-product-price-fallback]: ProductPrice 폴백 — manifest
 */
import { isDepartureRowPublicBookable } from '@/lib/departure-seat-availability'
import { prisma } from '@/lib/prisma'

export type ProductPriceSelect = {
  id: string
  priceFrom: number | null
  /** DB derived — bookable 출발 최저 성인가 (트리거·Seoul+2일 SSOT) */
  minBookableAdultPrice?: number | null
  departures?: Array<{
    adultPrice: number | null
    departureDate: Date
    seatCount?: number | null
    seatsStatusRaw?: string | null
    statusRaw?: string | null
    isBookable?: boolean | null
  }>
  /** 달력/가격표 행 — 출발행 미물질화 시 폴백 */
  prices?: Array<{ adult: number | null }>
}

function computeDeparturesAdultPriceMin(
  departures: ProductPriceSelect['departures'] | undefined,
  seatAware: boolean,
): number | null {
  const fromDep: number[] = []
  for (const d of departures ?? []) {
    if (d.adultPrice == null || d.adultPrice <= 0) continue
    if (seatAware && !isDepartureRowPublicBookable(d)) continue
    fromDep.push(d.adultPrice)
  }
  if (fromDep.length === 0) return null
  return Math.min(...fromDep)
}

function computeProductPriceAdultMin(prices: ProductPriceSelect['prices'] | undefined): number | null {
  const vals: number[] = []
  for (const row of prices ?? []) {
    if (row.adult == null || row.adult <= 0) continue
    vals.push(row.adult)
  }
  if (vals.length === 0) return null
  return Math.min(...vals)
}

export function computeEffectivePricePerPersonKrwFromRow(
  p: ProductPriceSelect,
  opts?: { seatAware?: boolean },
): number | null {
  const seatAware = opts?.seatAware ?? false
  const depMin = computeDeparturesAdultPriceMin(p.departures, seatAware)
  if (depMin != null && depMin > 0) return depMin

  if (!seatAware && p.minBookableAdultPrice != null && p.minBookableAdultPrice > 0) {
    return p.minBookableAdultPrice
  }

  if (p.priceFrom != null && p.priceFrom > 0) return p.priceFrom

  // REGRESSION-FREEZE[browse-price-product-price-fallback]: 출발행 없이 ProductPrice만 있는 상품 — manifest
  const priceTableMin = computeProductPriceAdultMin(p.prices)
  if (priceTableMin != null && priceTableMin > 0) return priceTableMin

  return null
}

/** Prisma include 스니펫 — browse API 외(시즌 그리드 등) 레거시 조회용 */
export const PRODUCT_PRICE_FOR_BROWSE_INCLUDE = {
  departures: {
    orderBy: { departureDate: 'asc' as const },
    select: { adultPrice: true, departureDate: true },
    take: 80,
  },
  prices: {
    select: { adult: true },
    take: 40,
    orderBy: { date: 'asc' as const },
  },
}

/**
 * browse 페이지 슬라이스 — ProductDeparture·priceFrom 없을 때 ProductPrice.adult 최저만 배치 조회.
 * REGRESSION-FREEZE[browse-price-product-price-fallback]: 문의 오표기 방지 — manifest
 */
export async function fetchProductPriceAdultMinByProductIds(
  productIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (productIds.length === 0) return out
  const rows = await prisma.productPrice.findMany({
    where: { productId: { in: productIds }, adult: { gt: 0 } },
    select: { productId: true, adult: true },
  })
  for (const r of rows) {
    const prev = out.get(r.productId)
    if (prev == null || r.adult < prev) out.set(r.productId, r.adult)
  }
  return out
}
