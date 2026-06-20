/**
 * kyowontour 일1회 sweep — KST 08:30 `sweepDueKyowontourProducts` 직접 호출.
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_KYOWONTOUR_SWEEP_CRON=1`
 */
export function startInstrumentationKyowontourSweepCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_KYOWONTOUR_SWEEP_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '30 8 * * *',
        () => {
          void tickKyowontourSweepCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[kyowontour-sweep-cron] registered: 30 8 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[kyowontour-sweep-cron] failed to load node-cron', e)
    })
}

async function tickKyowontourSweepCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[kyowontour-sweep-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { sweepDueKyowontourProducts } = await import('@/lib/kyowontour-sweep')
    const result = await sweepDueKyowontourProducts(prisma, { limit: 200 })
    console.log('[kyowontour-sweep-cron]', result)
  } catch (e) {
    console.error('[kyowontour-sweep-cron] error', e)
  }
}
