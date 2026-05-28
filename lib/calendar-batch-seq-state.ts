import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

export const CALENDAR_BATCH_CHUNK_DAYS = 14
export const CALENDAR_BATCH_HORIZON_DAYS = 180

export type CalendarBatchSeqState = {
  nextProductIndex: number
  updatedAt?: string
}

const DEFAULT: CalendarBatchSeqState = { nextProductIndex: 0 }

const STATE_DIR = process.env.CALENDAR_BATCH_STATE_DIR || path.join(process.cwd(), 'data')
const STATE_PATH = path.join(STATE_DIR, 'calendar-batch-seq.json')

function ensureDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true })
}

export function readCalendarBatchSeqState(): CalendarBatchSeqState {
  try {
    if (existsSync(STATE_PATH)) {
      const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as Partial<CalendarBatchSeqState>
      const idx =
        typeof parsed.nextProductIndex === 'number' && parsed.nextProductIndex >= 0
          ? Math.floor(parsed.nextProductIndex)
          : 0
      return { nextProductIndex: idx, updatedAt: parsed.updatedAt }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT }
}

export function writeCalendarBatchSeqState(state: CalendarBatchSeqState): CalendarBatchSeqState {
  ensureDir()
  const next: CalendarBatchSeqState = {
    nextProductIndex: Math.max(0, Math.floor(state.nextProductIndex)),
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(STATE_PATH, JSON.stringify(next, null, 2), 'utf-8')
  return next
}

export function wrapCalendarBatchSeqIndex(index: number, total: number): number {
  if (total <= 0) return 0
  return index >= total ? 0 : index
}
