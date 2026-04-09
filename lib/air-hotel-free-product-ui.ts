/**
 * 공항 픽업/샌딩 배지·에어텔 카드 노출 — 일반 패키지(`listingKind` travel·null 등)에는 표시하지 않는다.
 * 해외 항공권+호텔(자유여행) 상품(`listingKind === 'air_hotel_free'`) 전용.
 */
export function isAirHotelFreeListingForUi(listingKind: string | null | undefined): boolean {
  return listingKind === 'air_hotel_free'
}
