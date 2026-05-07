/**
 * D-4: 매일 04:30 KST 가격 미관측 180일 상품 자동 비공개 + Solapi 안내.
 */
export function startInstrumentationPriceFreshnessCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_PRICE_FRESHNESS_CRON === '1') {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '30 4 * * *',
        () => {
          void tickPriceFreshnessCron()
        },
        { timezone: 'Asia/Seoul' }
      )
      console.log('[price-freshness-cron] registered: 30 4 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[price-freshness-cron] failed to load node-cron', e)
    })
}

async function tickPriceFreshnessCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[price-freshness-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { autoUnpublishStaleProducts, isPriceFreshnessDryRun } = await import('@/lib/product-price-freshness')
    const r = await autoUnpublishStaleProducts(prisma, { dryRun: isPriceFreshnessDryRun() })
    console.log(
      '[price-freshness-cron] tick',
      JSON.stringify({
        candidates: r.candidateIds.length,
        updated: r.updatedCount,
        dryRun: r.dryRun,
        notifyAttempted: r.notifyAttempted,
        notifyOk: r.notifyOk,
        notifyMessage: r.notifyMessage ?? null,
      })
    )
  } catch (e) {
    console.error('[price-freshness-cron] error', e)
  }
}
