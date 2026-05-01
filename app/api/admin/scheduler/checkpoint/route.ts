import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'
import { determineScrapeStrategy } from '@/lib/scraper-schedule-strategy'

const CHECKPOINT_ID = 'calendar_price'
const HORIZON_DAYS = 180

function addCalendarDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

function seoulCalendarYmd(ref: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref)
}

function seoulWeekdaySun0(ref: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(ref)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[short] ?? 0
}

function nextMondaySeoulYmd(from: Date = new Date()): string {
  const ymd = seoulCalendarYmd(from)
  const w = seoulWeekdaySun0(from)
  const daysUntilMon = w === 0 ? 1 : w === 1 ? 7 : 8 - w
  return addCalendarDaysYmd(ymd, daysUntilMon)
}

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
    const daysFromTodayToLast = (t: string, last: string) => {
      const a = Date.parse(`${t}T12:00:00Z`)
      const b = Date.parse(`${last}T12:00:00Z`)
      if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
      return Math.round((b - a) / 86400000) + 1
    }
    const coveredDays = lastYmd ? Math.min(HORIZON_DAYS, daysFromTodayToLast(todayYmd, lastYmd)) : 0

    let nextRunHint: string
    if (strategy.shouldRunToday) {
      nextRunHint = '오늘 21:00 (KST) — instrumentation cron'
    } else if (strategy.mode === 'maintenance') {
      nextRunHint = `다음 월요일 21:00 (KST) 전후 — 약 ${nextMondaySeoulYmd()}`
    } else {
      nextRunHint = '오늘 21:00 (KST) — instrumentation cron'
    }

    const modeLabel =
      strategy.mode === 'maintenance'
        ? '유지 (월요일·전체 구간 재검증)'
        : strategy.mode === 'manual'
          ? '수동 범위'
          : `초기 수집 (90일 단위로 최대 ${HORIZON_DAYS}일까지)`

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
        coveredDaysOutOfHorizon: Math.min(coveredDays, HORIZON_DAYS),
        horizonDays: HORIZON_DAYS,
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
