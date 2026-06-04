/**
 * 메인 — 항공+호텔(자유여행). `/travel/air-hotel` 허브와 동일 browse 쿼리·필터 SSOT.
 */
import { getCachedProductsBrowsePayload } from '@/lib/products-browse-cached'
import { buildAirHotelHubBrowseQueryKey } from '@/lib/products-browse-hub-query'
import type { ResultItem } from '@/components/products/ProductResultsList'

const AIR_HOTEL_MAIN_BROWSE_KEY = buildAirHotelHubBrowseQueryKey(
  new URLSearchParams({ scope: 'overseas', type: 'air-hotel' }),
)

export async function getCachedAirHotelProductGridItems(): Promise<ResultItem[]> {
  const payload = await getCachedProductsBrowsePayload(AIR_HOTEL_MAIN_BROWSE_KEY)
  if (!payload.ok) return []
  return payload.items as ResultItem[]
}
