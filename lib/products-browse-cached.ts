import { unstable_cache } from 'next/cache'
import { productsBrowseBuildPayload } from '@/lib/products-browse-build-payload'
import { canonicalBrowseQueryKey } from '@/lib/products-browse-hub-query'

export type ProductsBrowseOkPayload = Awaited<ReturnType<typeof productsBrowseBuildPayload>>

const BROWSE_CACHE_TAG = 'products-browse-v19'

/** 동시 콜드 요청(허브 진입·cron·워밍)이 browse 빌드를 중복 실행하지 않도록 프로세스 내 합류 */
const inflightBrowseByKey = new Map<string, Promise<ProductsBrowseOkPayload>>()

function loadBrowsePayloadCached(queryKey: string): Promise<ProductsBrowseOkPayload> {
  return unstable_cache(
    () => productsBrowseBuildPayload(queryKey),
    [BROWSE_CACHE_TAG, queryKey],
    { revalidate: 3600, tags: ['products-browse'] },
  )()
}

/** browse API·RSC 공통 — queryKey는 canonical(정렬) 키로 통일해 워밍/홈 HIT 맞춤 */
export function getCachedProductsBrowsePayload(queryKey: string): Promise<ProductsBrowseOkPayload> {
  // REGRESSION-FREEZE[browse-preview-db-take]: canonical cache key — manifest
  const key = canonicalBrowseQueryKey(new URLSearchParams(queryKey))
  const inflight = inflightBrowseByKey.get(key)
  if (inflight) return inflight

  const work = loadBrowsePayloadCached(key).finally(() => {
    if (inflightBrowseByKey.get(key) === work) {
      inflightBrowseByKey.delete(key)
    }
  })
  inflightBrowseByKey.set(key, work)
  return work
}
