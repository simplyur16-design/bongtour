/**
 * PR 7: 매일 KST 03:00 인사이트 동기화 + 후킹 자동 학습.
 */
export function startInstrumentationInsightSyncCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_INSIGHT_SYNC_CRON === '1') {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 3 * * *',
        () => {
          void tickInsightSyncCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[insight-sync-cron] registered: 0 3 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[insight-sync-cron] failed to load node-cron', e)
    })
}

async function tickInsightSyncCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[insight-sync-cron] skip: DATABASE_URL')
      return
    }
    const r = await runInsightSyncTick('cron')
    console.log('[insight-sync-cron] tick', JSON.stringify(r))
  } catch (e) {
    console.error('[insight-sync-cron] error', e)
  }
}

export async function runInsightSyncTick(syncSource: 'cron' | 'manual') {
  const { syncAllInsights } = await import('@/lib/bong-marketing/insight-sync')
  const { learnHooksFromInsights } = await import('@/lib/bong-marketing/hook-auto-learner')

  const sync = await syncAllInsights(syncSource)
  const learn = await learnHooksFromInsights()
  return { sync, learn }
}
