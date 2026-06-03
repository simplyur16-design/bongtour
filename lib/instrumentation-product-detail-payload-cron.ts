/**
 * 매일 KST 00:05 — 등록 상품 `publicDetailPayloadJson` 전량 재빌드.
 * `bookableMinDateYmd` 일일 변경으로 인한 payload miss·live build(1.5~2s) 방지.
 *
 * production + DATABASE_URL (`instrumentation.ts` 가드).
 * 비활성화: `DISABLE_INSTRUMENTATION_PRODUCT_DETAIL_PAYLOAD_CRON=1`
 * Dry-run: `PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_DRY_RUN=1`
 */
import {
  PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_EXPR,
  PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_TZ,
  runProductDetailPayloadDailyRebuild,
} from '@/lib/product-detail-payload-daily-rebuild'

function isDailyRebuildDryRun(): boolean {
  return process.env.PRODUCT_DETAIL_PAYLOAD_DAILY_REBUILD_DRY_RUN === '1'
}

async function tickProductDetailPayloadDailyRebuildCron(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return
  }
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.warn('[product-detail-payload-cron] skip: DATABASE_URL')
    return
  }

  const dryRun = isDailyRebuildDryRun()
  console.log('[product-detail-payload-cron] tick start', { dryRun })

  try {
    const result = await runProductDetailPayloadDailyRebuild({ dryRun })
    console.log('[product-detail-payload-cron] tick done', {
      dryRun,
      total: result.total,
      ok: result.ok,
      failed: result.failed,
      skipped: result.skipped,
      durationMs: result.durationMs,
      failedSample: result.failedProductIds.slice(0, 8),
    })
  } catch (e) {
    console.error('[product-detail-payload-cron] tick error', e)
  }
}

export function startInstrumentationProductDetailPayloadCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_PRODUCT_DETAIL_PAYLOAD_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_EXPR,
        () => {
          void tickProductDetailPayloadDailyRebuildCron()
        },
        { timezone: PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_TZ },
      )
      console.log(
        `[product-detail-payload-cron] registered: ${PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_EXPR} (${PRODUCT_DETAIL_PAYLOAD_DAILY_CRON_TZ})`,
      )
    })
    .catch((e) => {
      console.error('[product-detail-payload-cron] failed to load node-cron', e)
    })
}
