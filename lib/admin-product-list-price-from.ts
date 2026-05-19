/**
 * 관리자 상품 목록 — `Product.priceFrom` 이 비었을 때 출발 행 최저 성인가로 표시만 보강.
 */
export function resolveAdminListPriceFrom(
  priceFrom: number | null | undefined,
  minDepartureAdultPrice: number | null | undefined
): number | null {
  if (priceFrom != null && Number.isFinite(priceFrom) && priceFrom > 0) return priceFrom
  if (minDepartureAdultPrice != null && Number.isFinite(minDepartureAdultPrice) && minDepartureAdultPrice > 0) {
    return Math.round(minDepartureAdultPrice)
  }
  return null
}
