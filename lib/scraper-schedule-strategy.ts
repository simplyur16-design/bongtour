import type { CalendarPriceBatchResult } from '@/lib/calendar-price-batch-runner'
import { prisma } from '@/lib/prisma'
import {
  CALENDAR_BATCH_HORIZON_DAYS,
  readCalendarBatchSeqState,
} from '@/lib/calendar-batch-seq-state'
import { addCalendarDaysYmd } from '@/lib/calendar-batch-product-window'

const CHECKPOINT_ID = 'calendar_price'

export const HORIZON_DAYS = CALENDAR_BATCH_HORIZON_DAYS

export type ScrapeScheduleMode = 'sequential' | 'manual'

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
  /** sequential: 다음 처리 상품 인덱스 (calendar-batch-seq.json) */
  nextProductIndex: number
}

export function seoulCalendarYmd(ref: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref)
}

export { addCalendarDaysYmd }

function ymdToUtcNoon(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

/**
 * sequential: 매일 실행, 상품별 14일 창은 products API·Python이 결정.
 * dateRange* 는 지평선(today~today+180) — 로그·env용.
 */
export async function determineScrapeStrategy(): Promise<ScrapeScheduleStrategy> {
  await ensureScraperCheckpointRow()
  const todaySeoulYmd = seoulCalendarYmd()
  const horizonYmd = addCalendarDaysYmd(todaySeoulYmd, HORIZON_DAYS)
  const seq = readCalendarBatchSeqState()

  return {
    shouldRunToday: true,
    mode: 'sequential',
    dateRangeStart: ymdToUtcNoon(todaySeoulYmd),
    dateRangeEnd: ymdToUtcNoon(horizonYmd),
    dateRangeStartYmd: todaySeoulYmd,
    dateRangeEndYmd: horizonYmd,
    horizonYmd,
    todaySeoulYmd,
    nextProductIndex: seq.nextProductIndex,
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
      lastRunMode: 'sequential',
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
  const status =
    batch.status === 'success' || batch.status === 'partial' || batch.status === 'failed'
      ? batch.status
      : 'failed'
  const errorMessage =
    status === 'partial'
      ? `일부 실패: 성공 ${batch.succeeded}, 실패 ${batch.failed}`
      : status === 'failed'
        ? batch.rawTail?.slice(0, 2000) ?? 'failed'
        : null
  await updateScrapeCheckpoint({
    lastCollectedDate: null,
    updateLastCollectedDate: false,
    mode: strategy.mode,
    status,
    totalProductsScraped: batch.succeeded,
    errorMessage,
  })
}
