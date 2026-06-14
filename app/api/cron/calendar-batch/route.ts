import { canRegisterCalendarCron } from '@/lib/calendar-batch-env'
import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { determineScrapeStrategy } from '@/lib/scraper-schedule-strategy'
import { spawnCalendarPriceBatchDetached } from '@/lib/scheduler-calendar-batch-lifecycle'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/calendar-batch — 5공급사 달력 가격 배치 1회 (detached).
 * Railway Cron·외부 스케줄러: `x-bongtour-cron-secret` + 3h 주기.
 */
export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard({ error: 'cron_secret_unconfigured' }, 'cron-calendar-batch', { status: 401 })
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'cron-calendar-batch', { status: 401 })
  }
  if (!canRegisterCalendarCron()) {
    return jsonWithLeakGuard({ error: 'calendar_batch_not_ready' }, 'cron-calendar-batch', { status: 503 })
  }

  try {
    const strategy = await determineScrapeStrategy()
    if (!strategy.shouldRunToday) {
      return jsonWithLeakGuard(
        { ok: false, skipped: true, reason: 'shouldRunToday_false', mode: strategy.mode },
        'cron-calendar-batch',
      )
    }
    const started = await spawnCalendarPriceBatchDetached(strategy)
    if (started === 'skipped') {
      return jsonWithLeakGuard({ ok: false, skipped: true, reason: 'lock' }, 'cron-calendar-batch', { status: 409 })
    }
    return jsonWithLeakGuard(
      {
        ok: true,
        started: true,
        mode: strategy.mode,
        nextProductIndex: strategy.nextProductIndex,
        horizonYmd: strategy.horizonYmd,
      },
      'cron-calendar-batch.response',
      { status: 202 },
    )
  } catch (e) {
    console.error('[cron/calendar-batch]', e)
    return jsonWithLeakGuard({ ok: false, error: 'batch_spawn_failed' }, 'cron-calendar-batch', { status: 500 })
  }
}
