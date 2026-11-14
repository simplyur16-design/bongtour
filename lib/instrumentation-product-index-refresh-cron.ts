/**
 * 워커 크론: 최근 updatedAt 변경분을 사이트맵·상세 경로에서 갱신하고, 소량일 때만 IndexNow.
 * 스키마 추가 없음. 워터마크는 프로세스 메모리라 재시작 후 15분만 다시 본다.
 * REGRESSION-FREEZE[seo-indexnow-public-key]: worker background cron — manifest
 */
import {
  PRODUCT_INDEX_REFRESH_BATCH,
  PRODUCT_INDEX_REFRESH_CRON,
  PRODUCT_INDEX_REFRESH_LOOKBACK_MS,
  nextProductIndexWatermark,
  shouldNotifyIndexNowForRecentBatch,
  type RecentProductRow,
} from '@/lib/seo/product-index-refresh'

let watermark: Date | null = null
let started = false

export function startInstrumentationProductIndexRefreshCron(): void {
  if (started) return
  if (process.env.DISABLE_PRODUCT_INDEX_REFRESH_CRON === '1') return
  started = true
  void import('node-cron')
    .then((m) => {
      m.default.schedule(
        PRODUCT_INDEX_REFRESH_CRON,
        () => {
          void tickProductIndexRefreshCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log(`[product-index-refresh-cron] registered: ${PRODUCT_INDEX_REFRESH_CRON} (Asia/Seoul)`)
    })
    .catch((e) => {
      started = false
      console.error('[product-index-refresh-cron] failed to load node-cron', e)
    })
}

export async function tickProductIndexRefreshCron(now: Date = new Date()): Promise<void> {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) return
    const since = watermark ?? new Date(now.getTime() - PRODUCT_INDEX_REFRESH_LOOKBACK_MS)
    const { prisma } = await import('@/lib/prisma')
    const rows = (await prisma.product.findMany({
      where: { updatedAt: { gt: since } },
      select: { id: true, slug: true, listingKind: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
      take: PRODUCT_INDEX_REFRESH_BATCH,
    })) as RecentProductRow[]
    if (rows.length === 0) return
    const { revalidateProductListingCaches } = await import('@/lib/revalidate-product-listing-caches')
    const { revalidateChangedProductPaths, productPublicUrlsForIndex } = await import('@/lib/seo/product-index-events')
    const { queueIndexNowUrls } = await import('@/lib/seo/indexnow')
    const { getSiteOrigin } = await import('@/lib/site-metadata')
    revalidateProductListingCaches()
    const origin = getSiteOrigin()
    const urls: string[] = []
    for (const row of rows) {
      revalidateChangedProductPaths(row)
      urls.push(...productPublicUrlsForIndex(origin, row))
    }
    if (shouldNotifyIndexNowForRecentBatch(rows.length)) {
      queueIndexNowUrls(urls)
    } else {
      console.info('[product-index-refresh-cron] SKIP indexnow_bulk', { count: rows.length })
    }
    watermark = nextProductIndexWatermark(rows, watermark)
  } catch (e) {
    console.error('[product-index-refresh-cron] error', e)
  }
}
