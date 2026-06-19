/**
 * verygoodtour 일1회 sweep — KST 08:00 `sweepDueVerygoodtourProducts` 직접 호출.
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_VERYGOODTOUR_SWEEP_CRON=1`
 */
export function startInstrumentationVerygoodtourSweepCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_VERYGOODTOUR_SWEEP_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 8 * * *',
        () => {
          void tickVerygoodtourSweepCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[verygoodtour-sweep-cron] registered: 0 8 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[verygoodtour-sweep-cron] failed to load node-cron', e)
    })
}

async function tickVerygoodtourSweepCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[verygoodtour-sweep-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { sweepDueVerygoodtourProducts } = await import('@/lib/verygoodtour-sweep')
    const result = await sweepDueVerygoodtourProducts(prisma, { limit: 200 })
    console.log('[verygoodtour-sweep-cron]', result)
  } catch (e) {
    console.error('[verygoodtour-sweep-cron] error', e)
  }
}
