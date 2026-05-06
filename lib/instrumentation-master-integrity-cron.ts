/**
 * I-7: 매일 03:00 (Asia/Seoul) 마스터·메가메뉴 정합 검증 + 이상 시 Solapi 알림.
 */
export function startInstrumentationMasterIntegrityCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_MASTER_INTEGRITY_CRON === '1') {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 3 * * *',
        () => {
          void tickMasterIntegrityCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[master-integrity-cron] registered: 0 3 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[master-integrity-cron] failed to load node-cron', e)
    })
}

async function tickMasterIntegrityCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[master-integrity-cron] skip: DATABASE_URL')
      return
    }
    const { runMasterIntegrityScheduledJob } = await import('@/lib/master-integrity-job')
    await runMasterIntegrityScheduledJob()
  } catch (e) {
    console.error('[master-integrity-cron] error', e)
  }
}
