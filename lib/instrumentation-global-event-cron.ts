/**
 * PR 8: 매주 월요일 KST 03:00 글로벌 이벤트 수집 (Gemini).
 */
export function startInstrumentationGlobalEventCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_GLOBAL_EVENT_CRON === '1') {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 3 * * 1',
        () => {
          void tickGlobalEventCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[global-event-cron] registered: 0 3 * * 1 (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[global-event-cron] failed to load node-cron', e)
    })
}

async function tickGlobalEventCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[global-event-cron] skip: DATABASE_URL')
      return
    }
    const { refreshGlobalEvents } = await import('@/lib/bong-marketing/global-event-collector')
    const r = await refreshGlobalEvents()
    console.log('[global-event-cron] tick', JSON.stringify(r))
  } catch (e) {
    console.error('[global-event-cron] error', e)
  }
}
