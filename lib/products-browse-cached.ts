import { unstable_cache } from 'next/cache'
import { productsBrowseBuildPayload } from '@/lib/products-browse-build-payload'

export type ProductsBrowseOkPayload = Awaited<ReturnType<typeof productsBrowseBuildPayload>>

const BROWSE_CACHE_TAG = 'products-browse-v17'

/** browse API·RSC 공통 — queryKey는 URLSearchParams.toString() 형식 */
export function getCachedProductsBrowsePayload(queryKey: string) {
  return unstable_cache(
    () => productsBrowseBuildPayload(queryKey),
    [BROWSE_CACHE_TAG, queryKey],
    { revalidate: 3600, tags: ['products-browse'] },
  )()
}
