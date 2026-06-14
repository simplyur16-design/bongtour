/**
 * Next instrumentation: 3시간마다 1회 (Asia/Seoul) 달력 가격 배치 — 5공급사 sequential.
 * 등록 조건: `lib/calendar-batch-env` `canRegisterCalendarCron()` (운영 또는 ENABLE_INSTRUMENTATION_CALENDAR_CRON=1).
 * web 단독 배포: detached spawn (`spawnCalendarPriceBatchDetached`) — worker와 동일 스케줄, HTTP 블로킹 없음.
 */
export function startInstrumentationCalendarCron(options?: { webFallback?: boolean }): void {
  const webFallback = options?.webFallback === true
  void import('node-cron')
    .then(async (m) => {
      const { getCalendarBatchReadiness, resolveBongtourApiBase } = await import('@/lib/calendar-batch-env')
      const readiness = getCalendarBatchReadiness()
      const cron = m.default
      cron.schedule(
        '0 */3 * * *',
        () => {
          void tickCalendarCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[calendar-cron] registered: 0 */3 * * * (Asia/Seoul)', {
        apiBase: resolveBongtourApiBase() || '(unset)',
        python: readiness.pythonExecutable,
        nodeEnv: readiness.nodeEnv,
        webFallback,
      })
      if (process.env.CALENDAR_CRON_RUN_ON_STARTUP === '1') {
        setTimeout(() => {
          void tickCalendarCron()
        }, 15_000)
        console.log('[calendar-cron] startup tick scheduled (+15s, CALENDAR_CRON_RUN_ON_STARTUP=1)')
      }
    })
    .catch((e) => {
      console.error('[calendar-cron] failed to load node-cron', e)
    })
}

async function tickCalendarCron() {
  try {
    const { getAdminServiceBearerSecret } = await import('@/lib/admin-secrets')
    if (!getAdminServiceBearerSecret().trim() && !(process.env.ADMIN_BYPASS_SECRET ?? '').trim()) {
      console.warn('[calendar-cron] skip: no ADMIN_SERVICE_BEARER_SECRET / ADMIN_BYPASS_SECRET')
      return
    }
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[calendar-cron] skip: DATABASE_URL')
      return
    }
    const { determineScrapeStrategy } = await import('@/lib/scraper-schedule-strategy')
    const { shouldRunBackgroundCrons } = await import('@/lib/instrumentation-process-role')
    const strategy = await determineScrapeStrategy()
    if (!strategy.shouldRunToday) {
      console.log('[calendar-cron] skip shouldRunToday=false', strategy.mode)
      return
    }
    if (!shouldRunBackgroundCrons()) {
      const { spawnCalendarPriceBatchDetached } = await import('@/lib/scheduler-calendar-batch-lifecycle')
      const r = await spawnCalendarPriceBatchDetached(strategy)
      if (r === 'skipped') {
        console.log('[calendar-cron] skipped (lock)')
        return
      }
      console.log('[calendar-cron] detached batch started (web)')
      return
    }
    const { runCalendarPriceBatchInline } = await import('@/lib/scheduler-calendar-batch-lifecycle')
    const r = await runCalendarPriceBatchInline(strategy)
    if (r === 'skipped') {
      console.log('[calendar-cron] skipped (lock)')
      return
    }
    console.log('[calendar-cron] finished', r.status, r.lastCollectedDateYmd)
  } catch (e) {
    console.error('[calendar-cron] error', e)
  }
}
