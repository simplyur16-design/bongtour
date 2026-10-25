/**
 * naeiltour 일1회 sweep — KST 09:30 `sweepDueNaeiltourProducts` 직접 호출.
 * heal-only(06:15/14:15/22:15)·kyowontour(08:30)과 겹치지 않음.
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_NAEILTOUR_SWEEP_CRON=1`
 */
export function startInstrumentationNaeiltourSweepCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_NAEILTOUR_SWEEP_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '30 9 * * *',
        () => {
          void tickNaeiltourSweepCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[naeiltour-sweep-cron] registered: 30 9 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[naeiltour-sweep-cron] failed to load node-cron', e)
    })
}

async function tickNaeiltourSweepCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[naeiltour-sweep-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { sweepDueNaeiltourProducts } = await import('@/lib/naeiltour-sweep')
    const result = await sweepDueNaeiltourProducts(prisma, { limit: 200 })
    console.log('[naeiltour-sweep-cron]', result)
  } catch (e) {
    console.error('[naeiltour-sweep-cron] error', e)
  }
}
