/**
 * 매일 KST 00:40 — 마지막 출발일 캐시 vs 실제 출발 row 불일치 점검·재계산 (`lib/departure-cache-reconcile.ts`).
 * 00:30 bookable derived 재동기화 직후, 00:05 상세 payload 재빌드와 겹치지 않게 둔다.
 *
 * production + DATABASE_URL (`instrumentation.ts` 가드).
 * 비활성화: `DISABLE_INSTRUMENTATION_DEPARTURE_CACHE_RECONCILE_CRON=1`
 * Dry-run: `DEPARTURE_CACHE_RECONCILE_CRON_DRY_RUN=1`
 * 기동 직후 1회(BOOT_DELAY_MS 뒤) 같은 점검을 돌린다 — 배포 시점에 캐시가 빈 채 공개 중이던 상품이
 * fail-closed 판정으로 00:40 까지 숨겨지는 공백을 막는다(쓰기 범위·상한 동일, 멱등).
 *
 * REGRESSION-FREEZE[departure-cache-nightly-reconcile]: 야간 worker 등록 — manifest
 */
const CRON_EXPR = '40 0 * * *'
/** 기동 후 1회 점검까지 대기(ms). */
export const DEPARTURE_CACHE_RECONCILE_BOOT_DELAY_MS = 90_000

export async function tickDepartureCacheReconcileCron(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.warn('[departure-cache-reconcile-cron] skip: DATABASE_URL')
    return
  }
  const dryRun = process.env.DEPARTURE_CACHE_RECONCILE_CRON_DRY_RUN === '1'
  const started = Date.now()
  try {
    const { prisma } = await import('@/lib/prisma')
    const { runDepartureCacheReconcile, buildDepartureCacheRollbackSql } = await import(
      '@/lib/departure-cache-reconcile'
    )
    const summary = await runDepartureCacheReconcile(prisma, { dryRun })
    console.log(
      '[departure-cache-reconcile-cron] done',
      JSON.stringify({
        todayYmd: summary.todayYmd,
        dryRun: summary.dryRun,
        mismatched: summary.mismatched,
        fixed: summary.fixed,
        capped: summary.capped,
        errors: summary.errors,
        byKind: summary.byKind,
        durationMs: Date.now() - started,
      }),
    )
    if (summary.rollback.length > 0) {
      console.log(
        '[departure-cache-reconcile-cron] rollback',
        JSON.stringify({
          entries: summary.rollback,
          sql: summary.rollback.map(buildDepartureCacheRollbackSql),
        }),
      )
    }
  } catch (e) {
    console.error('[departure-cache-reconcile-cron] error', e)
  }
}

export function startInstrumentationDepartureCacheReconcileCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_DEPARTURE_CACHE_RECONCILE_CRON === '1') return
  void import('node-cron')
    .then((m) => {
      m.default.schedule(
        CRON_EXPR,
        () => {
          void tickDepartureCacheReconcileCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log(`[departure-cache-reconcile-cron] registered: ${CRON_EXPR} (Asia/Seoul)`)
      // REGRESSION-FREEZE[departure-cache-nightly-reconcile]: 기동 직후 1회 catch-up(배포 직후 빈 캐시 공백 방지) — manifest
      const t = setTimeout(() => {
        void tickDepartureCacheReconcileCron()
      }, DEPARTURE_CACHE_RECONCILE_BOOT_DELAY_MS)
      t.unref?.()
    })
    .catch((e) => {
      console.error('[departure-cache-reconcile-cron] failed to load node-cron', e)
    })
}
