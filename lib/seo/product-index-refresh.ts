/**
 * 코드 밖(DB 직접 수정)으로 바뀐 상품을 기존 워커 크론이 주기적으로 사이트맵·상세 캐시에서 갱신한다.
 * 한 회차에 배치 상한만큼 꽉 차면 스윕으로 보고 IndexNow 는 하지 않는다(남용 방지). 그보다 적으면 묶어서 알린다.
 * REGRESSION-FREEZE[seo-indexnow-public-key]: 새 테이블 없음, updatedAt 워터마크는 프로세스 메모리 — manifest
 */
import type { ProductIndexEventInput } from '@/lib/seo/product-index-events'

export const PRODUCT_INDEX_REFRESH_BATCH = 200
export const PRODUCT_INDEX_REFRESH_LOOKBACK_MS = 15 * 60 * 1000
export const PRODUCT_INDEX_REFRESH_CRON = '*/10 * * * *'

export type RecentProductRow = {
  id: string
  slug: string | null
  listingKind: string | null
  updatedAt: Date
}

/** 상한까지 차면 대량 스윕으로 보고 IndexNow 를 건너뛴다. */
export function shouldNotifyIndexNowForRecentBatch(
  rowCount: number,
  batchCap: number = PRODUCT_INDEX_REFRESH_BATCH,
): boolean {
  return rowCount > 0 && rowCount < batchCap
}

export function nextProductIndexWatermark(rows: readonly RecentProductRow[], previous: Date | null): Date | null {
  if (rows.length === 0) return previous
  return rows[rows.length - 1]!.updatedAt
}

export function productIndexRefreshInputs(rows: readonly RecentProductRow[]): ProductIndexEventInput[] {
  return rows.map((row) => ({
    productId: row.id,
    slug: row.slug,
    listingKind: row.listingKind,
    skipLookup: true,
  }))
}
