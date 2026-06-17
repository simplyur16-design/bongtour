/**
 * PR 7: 매일 KST 02:00 Meta 장기 토큰 갱신 (만료 30일 전).
 */
export function startInstrumentationMetaTokenRefreshCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_META_TOKEN_REFRESH_CRON === '1') {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 2 * * *',
        () => {
          void tickMetaTokenRefreshCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[meta-token-refresh-cron] registered: 0 2 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[meta-token-refresh-cron] failed to load node-cron', e)
    })
}

async function tickMetaTokenRefreshCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[meta-token-refresh-cron] skip: DATABASE_URL')
      return
    }
    const { getValidMetaConnection } = await import('@/lib/bong-marketing/meta-token-manager')
    await getValidMetaConnection()
    console.log('[meta-token-refresh-cron] tick ok')
  } catch (e) {
    console.error('[meta-token-refresh-cron] error', e)
  }
}
