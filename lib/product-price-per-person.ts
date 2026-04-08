/**
 * 인당 가격 산정 — 예산 필터·목록 정렬·카드 표시용.
 *
 * 출발행(ProductDeparture)에 반영된 금액이 있으면 **그 최저만** 사용한다.
 * (오래된 priceFrom 대표가가 목록 최저가를 오염시키지 않도록 함)
 *
 * 출발행이 없거나 전부 null/0이면:
 *   레거시 ProductPrice.adult 최소 → 그다음 Product.priceFrom
 */
export type ProductPriceSelect = {
  id: string
  priceFrom: number | null
  departures: { adultPrice: number | null; departureDate: Date }[]
  prices: { adult: number }[]
}

export function computeEffectivePricePerPersonKrwFromRow(p: ProductPriceSelect): number | null {
  const fromDep: number[] = []
  for (const d of p.departures) {
    if (d.adultPrice != null && d.adultPrice > 0) fromDep.push(d.adultPrice)
  }
  if (fromDep.length > 0) return Math.min(...fromDep)

  const fromLegacy: number[] = []
  for (const x of p.prices) {
    if (x.adult > 0) fromLegacy.push(x.adult)
  }
  if (fromLegacy.length > 0) return Math.min(...fromLegacy)

  if (p.priceFrom != null && p.priceFrom > 0) return p.priceFrom

  return null
}

/** Prisma include 스니펫 — browse API에서 사용 */
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
