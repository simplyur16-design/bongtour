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
    releaseCalendarPriceBatchLock()
  }
}
