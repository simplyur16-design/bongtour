/**
 * modetour 일1회 sweep — KST 04:00 `sweepDueModetourProducts` 직접 호출.
 * production + DATABASE_URL (`instrumentation.ts` 가드). HTTP·BONGTOUR_CRON_SECRET 불필요.
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_MODETOUR_SWEEP_CRON=1`
 */
export function startInstrumentationModetourSweepCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_MODETOUR_SWEEP_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 4 * * *',
        () => {
          void tickModetourSweepCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[modetour-sweep-cron] registered: 0 4 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[modetour-sweep-cron] failed to load node-cron', e)
    })
}

async function tickModetourSweepCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[modetour-sweep-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { sweepDueModetourProducts } = await import('@/lib/modetour-sweep')
    const result = await sweepDueModetourProducts(prisma, { limit: 200 })
    console.log('[modetour-sweep-cron]', result)
  } catch (e) {
    console.error('[modetour-sweep-cron] error', e)
  }
}
