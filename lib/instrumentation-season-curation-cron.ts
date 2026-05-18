/**
 * SeasonalDestinationCuration — 서버 기동 1회 시드 + 매월 15일 00:00 KST 갱신.
 * dev(`npm run dev`)·production 공통. `DATABASE_URL`·`GEMINI_API_KEY` 필요.
 */
import { runSeasonCurationJob } from '@/lib/season-curation-job'

/** KST 매월 15일 00:00 */
const SEASON_CRON_EXPR = '0 0 15 * *'

/** 서버 기동 시 활성 사이클·+1/+2/+3 선행 사이클 확인(첫 dev·배포). */
async function seedSeasonCurationCycleOnStartup(): Promise<void> {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[season-curation-cron] startup seed skip: DATABASE_URL')
      return
    }
    const { getCurrentCycle } = await import('./season-curation')
    const now = new Date()
    const current = await getCurrentCycle(now)
    if (current) {
      console.log('[season-curation-cron] startup seed skip: active cycle exists', current.id)
    } else {
      const result = await runSeasonCurationJob(now, { force: true })
      console.log('[season-curation-cron] startup seed', {
        ok: result.ok,
        rotated: result.rotated,
        cycleId: result.cycle?.id ?? null,
        message: result.message ?? null,
      })
      if (!result.ok) return
    }
    const { ensureSeasonDestinationCyclesForMonthOffsets } = await import('./season-curation')
    await ensureSeasonDestinationCyclesForMonthOffsets([1, 2, 3], now)
    console.log('[season-curation-cron] startup ahead cycles ensured (+1/+2/+3)')
  } catch (e) {
    console.error('[season-curation-cron] startup seed error', e)
  }
}

export function startInstrumentationSeasonCurationCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_SEASON_CURATION_CRON === '1') {
    return
  }

  void seedSeasonCurationCycleOnStartup()

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        SEASON_CRON_EXPR,
        () => {
          void tickSeasonCurationCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log(`[season-curation-cron] registered: ${SEASON_CRON_EXPR} (Asia/Seoul, 매월 15일)`)
    })
    .catch((e) => {
      console.error('[season-curation-cron] failed to load node-cron', e)
    })
}

async function tickSeasonCurationCron(): Promise<void> {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[season-curation-cron] monthly tick skip: DATABASE_URL')
      return
    }
    const now = new Date()
    const result = await runSeasonCurationJob(now)
    console.log('[season-curation-cron] monthly tick (15일)', {
      ok: result.ok,
      rotated: result.rotated,
      cycleId: result.cycle?.id ?? null,
      message: result.message ?? null,
    })
  } catch (e) {
    console.error('[season-curation-cron] monthly tick error', e)
  }
}
