/**
 * 도시 leaf 목록 — Prisma city 태그가 이미 상품을 골랐는데
 * 제목 terms(요코하마 등)가 그 상품을 전부 지우면 terms를 비운다.
 * 제목과 맞는 다른 도시(도쿄·오사카)는 textMatchCount > 0 이라 terms를 유지한다.
 * REGRESSION-FREEZE[yokohama-menu-city-terms]: 태그 있는 도시 leaf를 제목 terms로 0건 만들지 않음 — manifest
 */
export function keepOverseasCityLeafTaggedRows(input: {
  city: string | null
  leafTerms: string[]
  taggedCount: number
  textMatchCount: number
}): string[] {
  if (
    (input.city ?? '').trim() &&
    input.leafTerms.length > 0 &&
    input.taggedCount > 0 &&
    input.textMatchCount === 0
  ) {
    return []
  }
  return input.leafTerms
}
