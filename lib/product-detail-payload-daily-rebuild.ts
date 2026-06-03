/**
 * 등록 상품 `publicDetailPayloadJson` 일괄 재빌드 — instrumentation cron·HTTP cron 공통.
 * SSOT: `rebuildProductPublicDetailPayload` (`lib/product-public-detail/persist-payload.ts`).
 */
import { revalidateTag } from 'next/cache'
import { rebuildProductPublicDetailPayload } from '@/lib/product-public-detail/persist-payload'

export const PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_EXPR = '5 0 * * *'
export const PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_TZ = 'Asia/Seoul'
export const PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_BATCH_DEFAULT = 5

export type ProductDetailPayloadDailyRebuildResult = {
  total: number
  ok: number
  failed: number
  skipped: number
  durationMs: number
  failedProductIds: string[]
}

export function productDetailPayloadDailyRebuildBatchSize(): number {
  const raw = process.env.PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_BATCH?.trim()
  if (!raw) return PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_BATCH_DEFAULT
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 20) : PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_BATCH_DEFAULT
}

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size))
  }
  return out
}

/**
 * `registrationStatus='registered'` 전 상품 DTO 재빌드.
 * 배치당 N건 순차 처리(기본 5) — DB·CPU 부하 완화.
 */
export async function runProductDetailPayloadDailyRebuild(options?: {
  batchSize?: number
  dryRun?: boolean
}): Promise<ProductDetailPayloadDailyRebuildResult> {
  const started = Date.now()
  const batchSize = options?.batchSize ?? productDetailPayloadDailyRebuildBatchSize()
  const dryRun = options?.dryRun === true

  const { prisma } = await import('@/lib/prisma')
  const rows = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  const ids = rows.map((r) => r.id)
  const failedProductIds: string[] = []
  let ok = 0
  let failed = 0
  let skipped = 0

  if (dryRun) {
    return {
      total: ids.length,
      ok: 0,
      failed: 0,
      skipped: ids.length,
      durationMs: Date.now() - started,
      failedProductIds: [],
    }
  }

  for (const batch of chunkIds(ids, batchSize)) {
    for (const productId of batch) {
      try {
        const rebuilt = await rebuildProductPublicDetailPayload(productId)
        if (rebuilt) {
          ok += 1
          revalidateTag(`product-detail-${productId}`)
        } else {
          skipped += 1
          console.warn('[product-detail-payload-daily-rebuild] skip (not registered or build null)', productId)
        }
      } catch (e) {
        failed += 1
        failedProductIds.push(productId)
        console.error('[product-detail-payload-daily-rebuild] failed', productId, e)
      }
    }
  }

  if (ok > 0) {
    revalidateTag('product-detail')
  }

  return {
    total: ids.length,
    ok,
    failed,
    skipped,
    durationMs: Date.now() - started,
    failedProductIds,
  }
}
