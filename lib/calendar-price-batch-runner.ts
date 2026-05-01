import { spawn } from 'child_process'
import { getAdminServiceBearerSecret } from '@/lib/admin-secrets'
import { resolvePythonExecutable } from '@/lib/resolve-python-executable'
import { getSchedulerEnvOverrides } from '@/lib/scheduler-config'

const RESULT_PREFIX = 'BONGTOUR_BATCH_RESULT:'

export type CalendarPriceBatchEnv = {
  dateRangeStartYmd: string
  dateRangeEndYmd: string
  mode: string
}

export type CalendarPriceBatchResult = {
  status: 'success' | 'partial' | 'failed'
  lastCollectedDateYmd: string | null
  totalProducts: number
  succeeded: number
  failed: number
  exitCode: number | null
  rawTail?: string
}

function parseBatchResultLine(text: string): CalendarPriceBatchResult | null {
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
        exitCode: st === 'failed' ? 1 : 0,
        rawTail: line,
      }
    } catch {
      return null
    }
  }
  return null
}

/**
 * Python `calendar_price_scheduler --once` 1회 실행(완료까지 대기).
 * env: SCRAPER_CALENDAR_RANGE_START/END, SCRAPER_BATCH_MODE
 */
export function runCalendarPriceBatchOnce(envOverlay: CalendarPriceBatchEnv): Promise<CalendarPriceBatchResult> {
  const py = resolvePythonExecutable()
  const cwd = process.cwd()
  const bearer = getAdminServiceBearerSecret()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONPATH: cwd,
    ...getSchedulerEnvOverrides(),
    SCRAPER_CALENDAR_RANGE_START: envOverlay.dateRangeStartYmd,
    SCRAPER_CALENDAR_RANGE_END: envOverlay.dateRangeEndYmd,
    SCRAPER_BATCH_MODE: envOverlay.mode,
  }
  if (bearer && !(env.ADMIN_BYPASS_SECRET ?? '').trim()) {
    env.ADMIN_BYPASS_SECRET = bearer
  }

  return new Promise((resolve) => {
    let out = ''
    let err = ''
    const child = spawn(py, ['-m', 'scripts.calendar_price_scheduler', '--once'], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.on('data', (c: Buffer) => {
      out += c.toString('utf8')
    })
    child.stderr?.on('data', (c: Buffer) => {
      err += c.toString('utf8')
    })
    child.on('error', (e) => {
      resolve({
        status: 'failed',
        lastCollectedDateYmd: null,
        totalProducts: 0,
        succeeded: 0,
        failed: 0,
        exitCode: 1,
        rawTail: e.message,
      })
    })
    child.on('close', (code) => {
      const combined = `${out}\n${err}`
      const parsed = parseBatchResultLine(combined)
      if (parsed) {
        parsed.exitCode = code
        resolve(parsed)
        return
      }
      resolve({
        status: 'failed',
        lastCollectedDateYmd: null,
        totalProducts: 0,
        succeeded: 0,
        failed: 0,
        exitCode: code,
        rawTail: err.slice(-400) || out.slice(-400),
      })
    })
  })
}
