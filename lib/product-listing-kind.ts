/**
 * 관리자·공개 공통 — 상품 노출 유형(listingKind)과 여행 범위(travelScope).
 * 공급사 파이프라인과 무관한 운영 메타.
 */

export const LISTING_KIND_VALUES = ['travel', 'private_trip', 'air_hotel_free'] as const
export type ListingKind = (typeof LISTING_KIND_VALUES)[number]

export const LISTING_KIND_LABELS: Record<ListingKind, string> = {
  travel: '여행상품',
  private_trip: '우리여행',
  air_hotel_free: '항공권+호텔(자유여행)',
}

export const TRAVEL_SCOPE_VALUES = ['domestic', 'overseas'] as const
export type ProductTravelScope = (typeof TRAVEL_SCOPE_VALUES)[number]

export const TRAVEL_SCOPE_LABELS: Record<ProductTravelScope, string> = {
  domestic: '국내',
  overseas: '해외',
}

export function parseListingKind(raw: string | null | undefined): ListingKind | null {
  if (raw == null || raw === '') return null
  const t = raw.trim()
  return LISTING_KIND_VALUES.includes(t as ListingKind) ? (t as ListingKind) : null
}

export function parseTravelScope(raw: string | null | undefined): ProductTravelScope | null {
  if (raw == null || raw === '') return null
  const t = raw.trim()
  return TRAVEL_SCOPE_VALUES.includes(t as ProductTravelScope) ? (t as ProductTravelScope) : null
}
