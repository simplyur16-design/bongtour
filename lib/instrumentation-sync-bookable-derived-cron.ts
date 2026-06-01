/**
 * 매일 KST 00:30 — `Product` bookable derived 컬럼 전량 재동기화(자정 경계·Seoul TZ 보정).
 * SSOT SQL: `lib/product-bookable-derived-sync.ts` (트리거는 출발 행 변경 시 즉시 반영).
 *
 * production + DATABASE_URL (`instrumentation.ts` 가드).
 * 비활성화: `DISABLE_INSTRUMENTATION_SYNC_BOOKABLE_DERIVED_CRON=1`
 * Dry-run: `SYNC_BOOKABLE_DERIVED_CRON_DRY_RUN=1`
 */
import { syncAllProductsBookableDerived } from '@/lib/product-bookable-derived-sync'

const CRON_EXPR = '30 0 * * *'

function isSyncBookableDerivedCronDryRun(): boolean {
  return process.env.SYNC_BOOKABLE_DERIVED_CRON_DRY_RUN === '1'
}

async function tickSyncBookableDerivedCron(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return
  }
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.warn('[sync-bookable-derived-cron] skip: DATABASE_URL')
    return
  }

  const dryRun = isSyncBookableDerivedCronDryRun()
  const started = Date.now()
  console.log('[sync-bookable-derived-cron] tick start', { dryRun })

  try {
    const { prisma } = await import('@/lib/prisma')
    const { productCount } = await syncAllProductsBookableDerived(prisma, { dryRun })
    console.log('[sync-bookable-derived-cron] tick done', {
      dryRun,
      productCount,
      durationMs: Date.now() - started,
    })
  } catch (e) {
    console.error('[sync-bookable-derived-cron] tick error', e)
  }
}

export function startInstrumentationSyncBookableDerivedCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_SYNC_BOOKABLE_DERIVED_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        CRON_EXPR,
        () => {
          void tickSyncBookableDerivedCron()
        },
        { timezone: 'Asia/Seoul' }
      )
      console.log(`[sync-bookable-derived-cron] registered: ${CRON_EXPR} (Asia/Seoul)`)
    })
    .catch((e) => {
      console.error('[sync-bookable-derived-cron] failed to load node-cron', e)
    })
}
