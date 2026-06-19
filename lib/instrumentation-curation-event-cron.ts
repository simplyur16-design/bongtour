/**
 * PR (가)-4: 매주 월요일 KST 03:00 CurationEvent 수집 (Gemini).
 */
export function startInstrumentationCurationEventCron(): void {
  if (
    process.env.DISABLE_INSTRUMENTATION_CURATION_EVENT_CRON === '1' ||
    process.env.DISABLE_INSTRUMENTATION_GLOBAL_EVENT_CRON === '1'
  ) {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 3 * * 1',
        () => {
          void tickCurationEventCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[curation-event-cron] registered: 0 3 * * 1 (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[curation-event-cron] failed to load node-cron', e)
    })
}

async function tickCurationEventCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[curation-event-cron] skip: DATABASE_URL')
      return
    }
    const { refreshCurationEvents } = await import('@/lib/bong-marketing/curation-event-collector')
    const r = await refreshCurationEvents()
    console.log('[curation-event-cron] tick', JSON.stringify(r))
  } catch (e) {
    console.error('[curation-event-cron] error', e)
  }
}
