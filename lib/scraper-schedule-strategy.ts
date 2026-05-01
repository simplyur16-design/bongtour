import type { CalendarPriceBatchResult } from '@/lib/calendar-price-batch-runner'
import { prisma } from '@/lib/prisma'

const CHECKPOINT_ID = 'calendar_price'
const HORIZON_DAYS = 180
const INITIAL_CHUNK_DAYS = 90

export type ScrapeScheduleMode = 'initial' | 'maintenance' | 'manual'

export type ScrapeScheduleStrategy = {
  shouldRunToday: boolean
  mode: ScrapeScheduleMode
  /** UTC 자정 기준 Date — API·env 전달용 */
  dateRangeStart: Date
  dateRangeEnd: Date
  dateRangeStartYmd: string
  dateRangeEndYmd: string
  horizonYmd: string
  todaySeoulYmd: string
}

function seoulCalendarYmd(ref: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref)
}

/** Seoul weekday: Mon=1 … Sun=0 (Date#getDay()와 동일) */
function seoulWeekdaySun0(ref: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(ref)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[short] ?? 0
}

function addCalendarDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

function ymdToUtcNoon(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * 체크포인트 조회 후 초기(매일 90일 단위) / 유지(월요일·전체 구간) 전략 결정.
 * `last_collected_date`는 배치가 마지막으로 끝까지 처리한 달력 **종료일**(범위 상한).
 */
export async function determineScrapeStrategy(): Promise<ScrapeScheduleStrategy> {
  await ensureScraperCheckpointRow()
  const todaySeoulYmd = seoulCalendarYmd()
  const horizonYmd = addCalendarDaysYmd(todaySeoulYmd, HORIZON_DAYS)

  const row = await prisma.bongsimScraperCheckpoint.findUnique({
    where: { id: CHECKPOINT_ID },
  })

  const lastYmd = row?.lastCollectedDate ? formatYmd(row.lastCollectedDate) : null

  const mondaySeoul = seoulWeekdaySun0() === 1

  // Phase 2: 이미 오늘 기준 6개월 끝까지(포함) 수집 완료
  if (lastYmd && lastYmd >= horizonYmd) {
    return {
      shouldRunToday: mondaySeoul,
      mode: 'maintenance',
      dateRangeStart: ymdToUtcNoon(todaySeoulYmd),
      dateRangeEnd: ymdToUtcNoon(horizonYmd),
      dateRangeStartYmd: todaySeoulYmd,
      dateRangeEndYmd: horizonYmd,
      horizonYmd,
      todaySeoulYmd,
    }
  }

  const rangeStartYmd = lastYmd ? addCalendarDaysYmd(lastYmd, 1) : todaySeoulYmd

  // 다음 구간 시작이 이미 지평선 이후면 유지 모드
  if (rangeStartYmd >= horizonYmd) {
    return {
      shouldRunToday: mondaySeoul,
      mode: 'maintenance',
      dateRangeStart: ymdToUtcNoon(todaySeoulYmd),
      dateRangeEnd: ymdToUtcNoon(horizonYmd),
      dateRangeStartYmd: todaySeoulYmd,
      dateRangeEndYmd: horizonYmd,
      horizonYmd,
      todaySeoulYmd,
    }
  }

  const rawEndYmd = addCalendarDaysYmd(rangeStartYmd, INITIAL_CHUNK_DAYS)
  const rangeEndYmd = rawEndYmd > horizonYmd ? horizonYmd : rawEndYmd

  return {
    shouldRunToday: true,
    mode: 'initial',
    dateRangeStart: ymdToUtcNoon(rangeStartYmd),
    dateRangeEnd: ymdToUtcNoon(rangeEndYmd),
    dateRangeStartYmd: rangeStartYmd,
    dateRangeEndYmd: rangeEndYmd,
    horizonYmd,
    todaySeoulYmd,
  }
}

export type UpdateCheckpointParams = {
  lastCollectedDate: Date | null
  /** null이면 last_collected_date 컬럼은 유지 */
  updateLastCollectedDate: boolean
  mode: string
  status: 'success' | 'partial' | 'failed'
  totalProductsScraped: number
  errorMessage?: string | null
}

export async function ensureScraperCheckpointRow(): Promise<void> {
  const todaySeoulYmd = seoulCalendarYmd()
  await prisma.bongsimScraperCheckpoint.upsert({
    where: { id: CHECKPOINT_ID },
    create: {
      id: CHECKPOINT_ID,
      lastCollectedDate: ymdToUtcNoon(todaySeoulYmd),
      lastRunMode: 'initial',
      lastRunStatus: 'pending',
      totalProductsScraped: 0,
    },
    update: {},
  })
}

export async function updateScrapeCheckpoint(params: UpdateCheckpointParams): Promise<void> {
  const { lastCollectedDate, updateLastCollectedDate, mode, status, totalProductsScraped, errorMessage } = params
  if (updateLastCollectedDate && lastCollectedDate) {
    await prisma.bongsimScraperCheckpoint.update({
      where: { id: CHECKPOINT_ID },
      data: {
        lastCollectedDate,
        lastRunAt: new Date(),
        lastRunMode: mode,
        lastRunStatus: status,
        totalProductsScraped,
        errorMessage: errorMessage ?? null,
        updatedAt: new Date(),
      },
    })
    return
  }
  await prisma.bongsimScraperCheckpoint.update({
    where: { id: CHECKPOINT_ID },
    data: {
      lastRunAt: new Date(),
      lastRunMode: mode,
      lastRunStatus: status,
      totalProductsScraped,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    },
  })
}

export async function finalizeCheckpointAfterBatch(
  strategy: ScrapeScheduleStrategy,
  batch: CalendarPriceBatchResult
): Promise<void> {
  if (batch.status === 'success') {
    const ymd = batch.lastCollectedDateYmd ?? strategy.dateRangeEndYmd
    await updateScrapeCheckpoint({
      lastCollectedDate: ymdToUtcNoon(ymd),
      updateLastCollectedDate: true,
      mode: strategy.mode,
      status: 'success',
      totalProductsScraped: batch.succeeded,
      errorMessage: null,
    })
    return
  }
  if (batch.status === 'partial') {
    const ymd = batch.lastCollectedDateYmd
    if (ymd) {
      await updateScrapeCheckpoint({
        lastCollectedDate: ymdToUtcNoon(ymd),
        updateLastCollectedDate: true,
        mode: strategy.mode,
        status: 'partial',
        totalProductsScraped: batch.succeeded,
        errorMessage: `일부 실패: 성공 ${batch.succeeded}, 실패 ${batch.failed}`,
      })
    } else {
      await updateScrapeCheckpoint({
        lastCollectedDate: null,
        updateLastCollectedDate: false,
        mode: strategy.mode,
        status: 'partial',
        totalProductsScraped: batch.succeeded,
        errorMessage: `일부 실패: 성공 ${batch.succeeded}, 실패 ${batch.failed}`,
      })
    }
    return
  }
  await updateScrapeCheckpoint({
    lastCollectedDate: null,
    updateLastCollectedDate: false,
    mode: strategy.mode,
    status: 'failed',
    totalProductsScraped: batch.succeeded,
    errorMessage: batch.rawTail?.slice(0, 2000) ?? 'failed',
  })
}
