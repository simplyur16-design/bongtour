/**
 * 인당 가격 산정 — 예산 필터·목록 정렬·카드 표시용.
 *
 * 출발행(ProductDeparture)에 반영된 금액이 있으면 **그 최저만** 사용한다.
 * (오래된 priceFrom 대표가가 목록 최저가를 오염시키지 않도록 함)
 *
 * 출발행이 없거나 전부 null/0이면 Product.priceFrom scalar 폴백.
 */
import { isDepartureRowPublicBookable } from '@/lib/departure-seat-availability'

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
