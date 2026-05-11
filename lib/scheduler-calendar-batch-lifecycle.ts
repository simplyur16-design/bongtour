import type { ChildProcess } from 'child_process'
import { runCalendarPriceBatchOnce, type CalendarPriceBatchResult } from '@/lib/calendar-price-batch-runner'
import {
  finalizeCheckpointAfterBatch,
  type ScrapeScheduleStrategy,
} from '@/lib/scraper-schedule-strategy'
import {
  releaseCalendarPriceBatchLock,
  tryAcquireCalendarPriceBatchLock,
} from '@/lib/scraper-calendar-batch-lock'
import { prisma } from '@/lib/prisma'
import { recordSupplierFinished } from '@/lib/scraper-on-demand-throttle'

/**
 * cron 배치 종료 시 5개 공급사 모두 일률 mark — Q2 정합 (cron 직후 on-demand G2 5~12s 인터벌 적용).
 * Python 측 결과 라인에 공급사별 정보가 없어 per-supplier 분리 불가 → 보수적으로 모두 mark.
 * 어떤 공급사가 이번 cron 에서 통신 안 했더라도 다음 on-demand 호출이 인터벌만큼 wait 할 뿐 손실 없음.
 */
const SCRAPER_SUPPLIERS_FOR_BATCH_MARK = ['hanatour', 'modetour', 'verygoodtour', 'ybtour', 'lottetour'] as const

async function markAllScrapersBatchFinished(): Promise<void> {
  await Promise.all(
    SCRAPER_SUPPLIERS_FOR_BATCH_MARK.map((s) => recordSupplierFinished(prisma, s).catch(() => {}))
  )
}

const RESULT_PREFIX = 'BONGTOUR_BATCH_RESULT:'

function parseBatchResultFromOutput(text: string): CalendarPriceBatchResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!line.startsWith(RESULT_PREFIX)) continue
    try {
      const j = JSON.parse(line.slice(RESULT_PREFIX.length)) as {
        status?: string
        lastCollectedDateYmd?: string | null
        totalProducts?: number
        succeeded?: number
        failed?: number
      }
      const st = j.status === 'success' || j.status === 'partial' || j.status === 'failed' ? j.status : 'failed'
      return {
        status: st,
        lastCollectedDateYmd: j.lastCollectedDateYmd ?? null,
        totalProducts: typeof j.totalProducts === 'number' ? j.totalProducts : 0,
        succeeded: typeof j.succeeded === 'number' ? j.succeeded : 0,
        failed: typeof j.failed === 'number' ? j.failed : 0,
        exitCode: 0,
        rawTail: line,
      }
    } catch {
      break
    }
  }
  return {
    status: 'failed',
    lastCollectedDateYmd: null,
    totalProducts: 0,
    succeeded: 0,
    failed: 0,
    exitCode: 1,
    rawTail: text.slice(-800),
  }
}

export function attachCalendarBatchFinalizeOnExit(child: ChildProcess, strategy: ScrapeScheduleStrategy): void {
  let combined = ''
  let finalized = false
  const drain = (c: Buffer | string) => {
    combined += typeof c === 'string' ? c : c.toString('utf8')
  }
  child.stdout?.on('data', drain)
  child.stderr?.on('data', drain)
  const runFinalize = () => {
    if (finalized) return
    finalized = true
    void (async () => {
      try {
        const parsed = parseBatchResultFromOutput(combined)
        parsed.exitCode = child.exitCode
        await finalizeCheckpointAfterBatch(strategy, parsed)
      } catch (e) {
        console.error('[calendar-batch] finalize:', e)
      } finally {
        await markAllScrapersBatchFinished()
        releaseCalendarPriceBatchLock()
      }
    })()
  }
  child.once('close', runFinalize)
  child.once('error', runFinalize)
}

export async function runCalendarPriceBatchInline(
  strategy: ScrapeScheduleStrategy
): Promise<CalendarPriceBatchResult | 'skipped'> {
  if (!tryAcquireCalendarPriceBatchLock()) {
    return 'skipped'
  }
  try {
    const r = await runCalendarPriceBatchOnce({
      dateRangeStartYmd: strategy.dateRangeStartYmd,
      dateRangeEndYmd: strategy.dateRangeEndYmd,
      mode: strategy.mode,
    })
    await finalizeCheckpointAfterBatch(strategy, r)
    return r
  } finally {
    await markAllScrapersBatchFinished()
    releaseCalendarPriceBatchLock()
  }
}
