/**
 * hanjintour 일 1회 신규 수집 — KST 10:30.
 * 기존 7곳 가격 sweep과 겹치지 않는다. 지역 필터 없이 목록 상품을 그대로 넘기며, 간격·재시도 1회·실패 SKIP은 한진 수집 모듈을 그대로 쓴다.
 * 비활성화: `DISABLE_INSTRUMENTATION_HANJINTOUR_SWEEP_CRON=1`
 * REGRESSION-FREEZE[hanjin-daily-ingest-1121]: 정기 수집 등록 — manifest
 */
export const HANJINTOUR_DAILY_INGEST_LIMIT = 20

export function startInstrumentationHanjintourSweepCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_HANJINTOUR_SWEEP_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '30 10 * * *',
        () => {
          void tickHanjintourSweepCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[hanjintour-sweep-cron] registered: 30 10 * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[hanjintour-sweep-cron] failed to load node-cron', e)
    })
}

async function tickHanjintourSweepCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[hanjintour-sweep-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { createHanjintourClient } = await import('@/lib/hanjintour-http')
    const { HANJINTOUR_EXISTING_SUPPLIERS } = await import('@/lib/hanjintour-region-filter')
    const { handleParseAndRegisterHanjintourRequest } = await import('@/lib/parse-and-register-hanjintour-handler')
    const { runHanjintourIngestPending } = await import('../scripts/hanjintour-ingest-pending')
    const summary = await runHanjintourIngestPending({
      client: createHanjintourClient(),
      apply: true,
      limit: HANJINTOUR_DAILY_INGEST_LIMIT,
      loadExistingRows: async () =>
        prisma.product.findMany({
          where: { originSource: { in: [...HANJINTOUR_EXISTING_SUPPLIERS] } },
          select: { originSource: true, title: true, destination: true, primaryDestination: true },
        }),
      register: (body) => handleParseAndRegisterHanjintourRequest(prisma, body),
    })
    console.log('[hanjintour-sweep-cron]', {
      listed: summary.listed,
      selected: summary.selected,
      applied: summary.applied,
      skipped: summary.skipped,
      skipReasons: summary.skipReasons,
      stoppedReason: summary.stoppedReason,
      held: summary.held,
      excluded: summary.excluded,
    })
  } catch (e) {
    console.error('[hanjintour-sweep-cron] skip', e instanceof Error ? e.name : 'error')
  }
}
