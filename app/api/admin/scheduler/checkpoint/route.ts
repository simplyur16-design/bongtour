import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'
import { determineScrapeStrategy } from '@/lib/scraper-schedule-strategy'
import { readCalendarBatchSeqState, CALENDAR_BATCH_CHUNK_DAYS } from '@/lib/calendar-batch-seq-state'

const CHECKPOINT_ID = 'calendar_price'
const HORIZON_DAYS = 180

/**
 * GET /api/admin/scheduler/checkpoint — 달력 가격 배치 체크포인트 + 다음 자동 실행 안내
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const row = await prisma.bongsimScraperCheckpoint.findUnique({
      where: { id: CHECKPOINT_ID },
    })
    const strategy = await determineScrapeStrategy()
    const todayYmd = strategy.todaySeoulYmd
    const horizonYmd = strategy.horizonYmd
    const lastYmd = row?.lastCollectedDate ? row.lastCollectedDate.toISOString().slice(0, 10) : null
    const seq = readCalendarBatchSeqState()

    const nextRunHint = '3시간 1회 (KST) — 5공급사 sequential (상품별 22일 창)'
    const modeLabel =
      strategy.mode === 'manual'
        ? '수동 범위'
        : `순차 수집 (상품별 ${CALENDAR_BATCH_CHUNK_DAYS}일, 지평선 ${HORIZON_DAYS}일)`

    return NextResponse.json({
      id: CHECKPOINT_ID,
      lastCollectedDate: lastYmd,
      lastRunAt: row?.lastRunAt?.toISOString() ?? null,
      lastRunMode: row?.lastRunMode ?? null,
      lastRunStatus: row?.lastRunStatus ?? null,
      totalProductsScraped: row?.totalProductsScraped ?? 0,
      errorMessage: row?.errorMessage ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      horizonYmd,
      todaySeoulYmd: todayYmd,
      currentMode: strategy.mode,
      modeLabel,
      nextRunHint,
      progress: {
        nextProductIndex: seq.nextProductIndex,
        horizonDays: HORIZON_DAYS,
        chunkDays: CALENDAR_BATCH_CHUNK_DAYS,
      },
      activeDateRange: {
        startYmd: strategy.dateRangeStartYmd,
        endYmd: strategy.dateRangeEndYmd,
      },
    })
  } catch (e) {
    console.error('scheduler checkpoint GET:', e)
    return NextResponse.json(
      { error: '체크포인트를 불러오지 못했습니다. DB에 bongsim_scraper_checkpoint 테이블이 있는지 확인하세요.' },
      { status: 500 }
    )
  }
}
