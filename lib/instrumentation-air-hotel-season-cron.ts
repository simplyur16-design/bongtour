/**
 * AirHotelSeasonCuration — 매월 25일 00:00 KST Gemini job (instrumentation only, HTTP route 없음).
 * `NODE_ENV=production` + `DATABASE_URL` 필요. `BONGTOUR_CRON_SECRET` 불필요.
 */
import { getAirHotelCycleIdForNow } from '@/lib/air-hotel-season-curation-constants'
import { runAirHotelSeasonCurationJob } from '@/lib/air-hotel-season-curation-job'

/** KST 매월 25일 00:00 — cycle 전환 (+1/+2/+3월 노출 갱신) */
const AIR_HOTEL_SEASON_CRON_EXPR = '0 0 25 * *'

export function startInstrumentationAirHotelSeasonCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_AIR_HOTEL_SEASON_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        AIR_HOTEL_SEASON_CRON_EXPR,
        () => {
          void tickAirHotelSeasonCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log(
        `[air-hotel-season-cron] registered: ${AIR_HOTEL_SEASON_CRON_EXPR} (Asia/Seoul, 매월 25일)`,
      )
    })
    .catch((e) => {
      console.error('[air-hotel-season-cron] failed to load node-cron', e)
    })
}

async function tickAirHotelSeasonCron(): Promise<void> {
  const cycleId = getAirHotelCycleIdForNow()
  console.log('[air-hotel-season-cron] tick start', { cycleId })
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[air-hotel-season-cron] skip: NODE_ENV !== production')
      return
    }
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[air-hotel-season-cron] skip: DATABASE_URL')
      return
    }

    const result = await runAirHotelSeasonCurationJob({ cycleId })

    const { prisma } = await import('@/lib/prisma')
    const row = await prisma.airHotelSeasonCuration.findUnique({
      where: { cycleId: result.cycleId },
      select: { geminiResponse: true },
    })
    const gr = row?.geminiResponse as { source?: string; fallback?: boolean } | null
    const source = gr?.source ?? (gr?.fallback ? 'fallback' : 'unknown')

    console.log('[air-hotel-season-cron] tick done', {
      cycleId: result.cycleId,
      linkedCount: result.linkedCount,
      messageOk: result.messageOk,
      heroOk: result.heroOk,
      source,
    })
  } catch (e) {
    console.error('[air-hotel-season-cron] tick error', e)
  }
}
