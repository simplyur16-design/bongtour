/**
 * ybtour 일1회 sweep — KST 06:00 `sweepDueYbtourProducts` 직접 호출.
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_YBTOUR_SWEEP_CRON=1`
 */
export function startInstrumentationYbtourSweepCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_YBTOUR_SWEEP_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 6 * * *',
        () => {
          void tickYbtourSweepCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[ybtour-sweep-cron] registered: 0 6 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[ybtour-sweep-cron] failed to load node-cron', e)
    })
}

async function tickYbtourSweepCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[ybtour-sweep-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { sweepDueYbtourProducts } = await import('@/lib/ybtour-sweep')
    const result = await sweepDueYbtourProducts(prisma, { limit: 200 })
    console.log('[ybtour-sweep-cron]', result)
  } catch (e) {
    console.error('[ybtour-sweep-cron] error', e)
  }
}
