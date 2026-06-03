import { getCachedProductsBrowsePayload, type ProductsBrowseOkPayload } from '@/lib/products-browse-cached'
import {
  buildAirHotelHubBrowseQueryKey,
  buildOverseasHubBrowseQueryKey,
  searchParamsRecordToUrlSearchParams,
} from '@/lib/products-browse-hub-query'

export type HubBrowsePrefetch = {
  queryKey: string
  payload: ProductsBrowseOkPayload
}

export async function prefetchOverseasHubBrowse(
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

export async function prefetchAirHotelHubBrowse(
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
