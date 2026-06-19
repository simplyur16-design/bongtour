/**
 * hanatour 일1회 sweep — KST 05:00 `sweepDueHanatourProducts` 직접 호출.
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_HANATOUR_SWEEP_CRON=1`
 */
export function startInstrumentationHanatourSweepCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_HANATOUR_SWEEP_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 5 * * *',
        () => {
          void tickHanatourSweepCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[hanatour-sweep-cron] registered: 0 5 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[hanatour-sweep-cron] failed to load node-cron', e)
    })
}

async function tickHanatourSweepCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[hanatour-sweep-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { sweepDueHanatourProducts } = await import('@/lib/hanatour-sweep')
    const result = await sweepDueHanatourProducts(prisma, { limit: 200 })
    console.log('[hanatour-sweep-cron]', result)
  } catch (e) {
    console.error('[hanatour-sweep-cron] error', e)
  }
}
