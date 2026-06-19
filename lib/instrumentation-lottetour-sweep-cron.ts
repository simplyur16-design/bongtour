/**
 * lottetour 일1회 sweep — KST 07:00 `sweepDueLottetourProducts` 직접 호출.
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_LOTTETOUR_SWEEP_CRON=1`
 */
export function startInstrumentationLottetourSweepCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_LOTTETOUR_SWEEP_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 7 * * *',
        () => {
          void tickLottetourSweepCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[lottetour-sweep-cron] registered: 0 7 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[lottetour-sweep-cron] failed to load node-cron', e)
    })
}

async function tickLottetourSweepCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[lottetour-sweep-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { sweepDueLottetourProducts } = await import('@/lib/lottetour-sweep')
    const result = await sweepDueLottetourProducts(prisma, { limit: 200 })
    console.log('[lottetour-sweep-cron]', result)
  } catch (e) {
    console.error('[lottetour-sweep-cron] error', e)
  }
}
