import { unstable_cache } from 'next/cache'
import { productsBrowseBuildPayload } from '@/lib/products-browse-build-payload'

export type ProductsBrowseOkPayload = Awaited<ReturnType<typeof productsBrowseBuildPayload>>

const BROWSE_CACHE_TAG = 'products-browse-v18'

/** 동시 콜드 요청(허브 진입·cron·워밍)이 browse 빌드를 중복 실행하지 않도록 프로세스 내 합류 */
const inflightBrowseByKey = new Map<string, Promise<ProductsBrowseOkPayload>>()

function loadBrowsePayloadCached(queryKey: string): Promise<ProductsBrowseOkPayload> {
  return unstable_cache(
    () => productsBrowseBuildPayload(queryKey),
    [BROWSE_CACHE_TAG, queryKey],
    { revalidate: 3600, tags: ['products-browse'] },
  )()
}

/** browse API·RSC 공통 — queryKey는 URLSearchParams.toString() 형식 */
export function getCachedProductsBrowsePayload(queryKey: string): Promise<ProductsBrowseOkPayload> {
  const inflight = inflightBrowseByKey.get(queryKey)
  if (inflight) return inflight

  const work = loadBrowsePayloadCached(queryKey).finally(() => {
    if (inflightBrowseByKey.get(queryKey) === work) {
      inflightBrowseByKey.delete(queryKey)
    }
  })
  inflightBrowseByKey.set(queryKey, work)
  return work
}
