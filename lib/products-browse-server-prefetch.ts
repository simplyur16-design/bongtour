import { getCachedProductsBrowsePayload, type ProductsBrowseOkPayload } from '@/lib/products-browse-cached'
import {
  buildAirHotelHubBrowseQueryKey,
  buildOverseasHubBrowseQueryKey,
  searchParamsRecordToUrlSearchParams,
} from '@/lib/products-browse-hub-query'
import { hubBrowsePrefetchWithTimeout } from '@/lib/products-browse-hub-prefetch-timeout'

export type HubBrowsePrefetch = {
  queryKey: string
  payload: ProductsBrowseOkPayload
}

async function prefetchOverseasHubBrowseUncapped(
  sp: Record<string, string | string[] | undefined>,
): Promise<HubBrowsePrefetch | null> {
  try {
    const queryKey = buildOverseasHubBrowseQueryKey(searchParamsRecordToUrlSearchParams(sp))
    const payload = await getCachedProductsBrowsePayload(queryKey)
    return { queryKey, payload }
  } catch (e) {
    console.error('[prefetchOverseasHubBrowse]', e)
    return null
  }
}

async function prefetchAirHotelHubBrowseUncapped(
  sp: Record<string, string | string[] | undefined>,
): Promise<HubBrowsePrefetch | null> {
  try {
    const queryKey = buildAirHotelHubBrowseQueryKey(searchParamsRecordToUrlSearchParams(sp))
    const payload = await getCachedProductsBrowsePayload(queryKey)
    return { queryKey, payload }
  } catch (e) {
    console.error('[prefetchAirHotelHubBrowse]', e)
    return null
  }
}

/** RSC용 — 타임아웃 초과 시 null(본문 블로킹 없음) */
export function prefetchOverseasHubBrowse(
  sp: Record<string, string | string[] | undefined>,
): Promise<HubBrowsePrefetch | null> {
  return hubBrowsePrefetchWithTimeout(prefetchOverseasHubBrowseUncapped(sp))
}

export function prefetchAirHotelHubBrowse(
  sp: Record<string, string | string[] | undefined>,
): Promise<HubBrowsePrefetch | null> {
  return hubBrowsePrefetchWithTimeout(prefetchAirHotelHubBrowseUncapped(sp))
}
