/**
 * 등록 상품 `publicDetailPayloadJson` 일괄 재빌드 — instrumentation cron·HTTP cron 공통.
 * SSOT: `rebuildProductPublicDetailPayload` (`lib/product-public-detail/persist-payload.ts`).
 */
import { revalidateTag } from 'next/cache'
import { productDetailPayloadDtoHit } from '@/lib/product-detail-payload-hit'
import { rebuildProductPublicDetailPayload } from '@/lib/product-public-detail/persist-payload'

export const PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_EXPR = '5 0 * * *'
export const PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_TZ = 'Asia/Seoul'
export const PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_BATCH_DEFAULT = 5

export type ProductDetailPayloadDailyRebuildResult = {
  /** registered 전체 스캔 수 */
  registeredTotal: number
  /** DTO miss·null — rebuild 대상 */
  staleTotal: number
  ok: number
  failed: number
  skipped: number
  durationMs: number
  failedProductIds: string[]
  /** @deprecated registeredTotal — cron 로그 하위 호환 */
  total: number
}

export const PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_BATCH_SLEEP_MS_DEFAULT = 500

const FAILURE_MESSAGE_LOG_CAP = 20

export type ProductDetailPayloadRebuildFailureLog = {
  productId: string
  message: string
}

function toKstIso(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    fractionalSecondDigits: 3,
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}:${pick('second')}.${pick('fractionalSecond')}+09:00`
}

function rebuildFailureMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** Railway grep: `product-detail-payload-daily-rebuild] summary` */
function logProductDetailPayloadDailyRebuildSummary(input: {
  startedAt: Date
  endedAt: Date
  registeredTotal: number
  staleBefore: number
  ok: number
  failed: number
  skipped: number
  failedProductIds: string[]
  failures: ProductDetailPayloadRebuildFailureLog[]
}): void {
  const staleAfter = input.staleBefore - input.ok
  const summary = {
    startedAt: toKstIso(input.startedAt),
    endedAt: toKstIso(input.endedAt),
    registeredTotal: input.registeredTotal,
    staleTotal: input.staleBefore,
    staleBefore: input.staleBefore,
    staleAfter,
    ok: input.ok,
    failed: input.failed,
    skipped: input.skipped,
    durationMs: input.endedAt.getTime() - input.startedAt.getTime(),
    failedIds: input.failedProductIds,
    failures: input.failures,
  }
  console.log(`[product-detail-payload-daily-rebuild] summary ${JSON.stringify(summary)}`)
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

export function productDetailPayloadDailyRebuildBatchSleepMs(): number {
  const raw = process.env.PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_BATCH_SLEEP_MS?.trim()
  if (!raw) return PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_BATCH_SLEEP_MS_DEFAULT
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 10_000) : PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_BATCH_SLEEP_MS_DEFAULT
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** registered rows 중 payload DTO miss(null 포함) — idempotent rebuild 대상 */
export function filterStaleDetailPayloadProductIds(
  rows: Array<{ id: string; publicDetailPayloadJson: string | null }>,
  baseDate: Date = new Date(),
): string[] {
  return rows
    .filter((row) => !productDetailPayloadDtoHit(row.publicDetailPayloadJson, baseDate))
    .map((row) => row.id)
}

/**
 * `registrationStatus='registered'` 중 stale payload만 DTO 재빌드.
 * 배치당 N건 순차 처리 + 배치 간 sleep(기본 500ms) — DB·CPU 스파이크 완화.
 */
export async function runProductDetailPayloadDailyRebuild(options?: {
  batchSize?: number
  batchSleepMs?: number
  baseDate?: Date
  dryRun?: boolean
}): Promise<ProductDetailPayloadDailyRebuildResult> {
  const startedAt = new Date()
  const started = startedAt.getTime()
  const batchSize = options?.batchSize ?? productDetailPayloadDailyRebuildBatchSize()
  const batchSleepMs = options?.batchSleepMs ?? productDetailPayloadDailyRebuildBatchSleepMs()
  const baseDate = options?.baseDate ?? new Date()
  const dryRun = options?.dryRun === true

  const { prisma } = await import('@/lib/prisma')
  const rows = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: { id: true, publicDetailPayloadJson: true },
    orderBy: { id: 'asc' },
  })
  const registeredTotal = rows.length
  const staleIds = filterStaleDetailPayloadProductIds(rows, baseDate)
  const staleTotal = staleIds.length

  console.log('[product-detail-payload-daily-rebuild] start', {
    registeredTotal,
    staleTotal,
    batchSize,
    batchSleepMs,
    dryRun,
  })

  const failedProductIds: string[] = []
  const failures: ProductDetailPayloadRebuildFailureLog[] = []
  let ok = 0
  let failed = 0
  let skipped = 0

  if (dryRun) {
    const endedAt = new Date()
    const result = {
      registeredTotal,
      staleTotal,
      ok: 0,
      failed: 0,
      skipped: staleTotal,
      durationMs: endedAt.getTime() - started,
      failedProductIds: [],
      total: registeredTotal,
    }
    console.log('[product-detail-payload-daily-rebuild] done (dry-run)', result)
    logProductDetailPayloadDailyRebuildSummary({
      startedAt,
      endedAt,
      registeredTotal,
      staleBefore: staleTotal,
      ok: 0,
      failed: 0,
      skipped: staleTotal,
      failedProductIds: [],
      failures: [],
    })
    return result
  }

  if (staleTotal === 0) {
    const endedAt = new Date()
    const result = {
      registeredTotal,
      staleTotal: 0,
      ok: 0,
      failed: 0,
      skipped: 0,
      durationMs: endedAt.getTime() - started,
      failedProductIds: [],
      total: registeredTotal,
    }
    console.log('[product-detail-payload-daily-rebuild] nothing to do (no stale payloads)')
    logProductDetailPayloadDailyRebuildSummary({
      startedAt,
      endedAt,
      registeredTotal,
      staleBefore: 0,
      ok: 0,
      failed: 0,
      skipped: 0,
      failedProductIds: [],
      failures: [],
    })
    return result
  }

  const batches = chunkIds(staleIds, batchSize)
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]!
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
        if (failures.length < FAILURE_MESSAGE_LOG_CAP) {
          failures.push({ productId, message: rebuildFailureMessage(e) })
        }
        console.error('[product-detail-payload-daily-rebuild] failed', productId, e)
      }
    }
    if (batchIdx < batches.length - 1 && batchSleepMs > 0) {
      await sleep(batchSleepMs)
    }
  }

  if (ok > 0) {
    revalidateTag('product-detail')
  }

  const endedAt = new Date()
  const result = {
    registeredTotal,
    staleTotal,
    ok,
    failed,
    skipped,
    durationMs: endedAt.getTime() - started,
    failedProductIds,
    total: registeredTotal,
  }
  console.log('[product-detail-payload-daily-rebuild] done', result)
  logProductDetailPayloadDailyRebuildSummary({
    startedAt,
    endedAt,
    registeredTotal,
    staleBefore: staleTotal,
    ok,
    failed,
    skipped,
    failedProductIds,
    failures,
  })
  return result
}
