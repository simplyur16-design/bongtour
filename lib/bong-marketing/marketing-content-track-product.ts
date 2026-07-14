/**
 * 콘텐츠 자동화 — 패키지 vs 자유여행(항공+호텔) 상품 풀 분리 SSOT.
 *
 * REGRESSION-FREEZE[marketing-content-track-product-gate]: package/airtel listingKind 게이트 — manifest
 */
import {
  AIR_HOTEL_LISTING_KIND,
  isAirHotelProduct,
} from '@/lib/air-hotel-product-ssot'

/** 블로그·카드뉴스 contentTrack 과 동일 */
export type MarketingContentTrack = 'package' | 'airtel'

const FIT_LISTING_KINDS = new Set([AIR_HOTEL_LISTING_KIND, 'private_trip'])

export type MarketingTrackProductRef = {
  id: string
  listingKind?: string | null
  productType?: string | null
}

/** 패키지 콘텐츠용 — 자유여행·우리여행·국외연수 제외 (null listingKind = 레거시 패키지) */
export function isPackageMarketingProduct(p: MarketingTrackProductRef): boolean {
  const lk = (p.listingKind ?? '').trim()
  if (lk === 'overseas_training') return false
  if (FIT_LISTING_KINDS.has(lk)) return false
  if (isAirHotelProduct(p)) return false
  return true
}

/** 자유여행(항공+호텔) 콘텐츠용 — listingKind/productType SSOT */
export function isAirtelMarketingProduct(p: MarketingTrackProductRef): boolean {
  return isAirHotelProduct(p)
}

export function isProductCompatibleWithMarketingTrack(
  p: MarketingTrackProductRef,
  track: MarketingContentTrack,
): boolean {
  return track === 'airtel' ? isAirtelMarketingProduct(p) : isPackageMarketingProduct(p)
}

export function filterProductsByMarketingTrack<T extends MarketingTrackProductRef>(
  products: readonly T[],
  track: MarketingContentTrack,
): T[] {
  return products.filter((p) => isProductCompatibleWithMarketingTrack(p, track))
}

/** 추천 매칭 ID 중 트랙에 맞는 첫 상품 (없으면 null) */
export function pickLinkedProductIdForMarketingTrack(
  productIds: readonly string[],
  productsById: ReadonlyMap<string, MarketingTrackProductRef>,
  track: MarketingContentTrack,
): string | null {
  for (const id of productIds) {
    const p = productsById.get(id)
    if (!p) continue
    if (isProductCompatibleWithMarketingTrack(p, track)) return id
  }
  return null
}

export function filterProductIdsByMarketingTrack(
  productIds: readonly string[],
  productsById: ReadonlyMap<string, MarketingTrackProductRef>,
  track: MarketingContentTrack,
): string[] {
  return productIds.filter((id) => {
    const p = productsById.get(id)
    return p ? isProductCompatibleWithMarketingTrack(p, track) : false
  })
}
