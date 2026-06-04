/**
 * 공항 픽업/샌딩 배지·항공+호텔 카드 노출 — 일반 패키지에는 표시하지 않는다.
 */
import { isAirHotelListingKind } from '@/lib/air-hotel-product-ssot'

export function isAirHotelFreeListingForUi(listingKind: string | null | undefined): boolean {
  return isAirHotelListingKind(listingKind)
}
