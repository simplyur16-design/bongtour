import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { getAdminServiceBearerSecret } from '@/lib/admin-secrets'
import { resolvePythonExecutable } from '@/lib/resolve-python-executable'
import * as logStream from '@/lib/admin-log-stream'
import { getSchedulerEnvOverrides } from '@/lib/scheduler-config'
import { tryBeginStreamRun } from '@/lib/scheduler-run-once-gate'
import { attachCalendarBatchFinalizeOnExit } from '@/lib/scheduler-calendar-batch-lifecycle'
import { requireAdmin } from '@/lib/require-admin'
import {
  determineScrapeStrategy,
  type ScrapeScheduleStrategy,
} from '@/lib/scraper-schedule-strategy'
import { tryAcquireCalendarPriceBatchLock, releaseCalendarPriceBatchLock } from '@/lib/scraper-calendar-batch-lock'

type BodyJson = {
  dateRangeStart?: string
  dateRangeEnd?: string
  /** YYYY-MM-DD */
  dateRangeStartYmd?: string
  dateRangeEndYmd?: string
}

function ymdFromInput(s: string | undefined): string | null {
  const t = (s ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  return t
}

async function resolveStrategyFromRequest(body: BodyJson | null): Promise<ScrapeScheduleStrategy> {
  const a = ymdFromInput(body?.dateRangeStart ?? body?.dateRangeStartYmd)
  const b = ymdFromInput(body?.dateRangeEnd ?? body?.dateRangeEndYmd)
  if (a && b && a <= b) {
    const today = await determineScrapeStrategy()
    return {
      shouldRunToday: true,
      mode: 'manual',
      dateRangeStart: new Date(`${a}T12:00:00.000Z`),
      dateRangeEnd: new Date(`${b}T12:00:00.000Z`),
      dateRangeStartYmd: a,
      dateRangeEndYmd: b,
      horizonYmd: today.horizonYmd,
      todaySeoulYmd: today.todaySeoulYmd,
    }
  }
  return determineScrapeStrategy()
}

/**
 * POST /api/admin/scheduler/run-once. 인증: 관리자.
 * Body(선택): { dateRangeStart?, dateRangeEnd? } — YYYY-MM-DD, 없으면 `determineScrapeStrategy()`.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const stream = searchParams.get('stream') === '1'
    let body: BodyJson | null = null
    try {
      const txt = await req.text()
      if (txt.trim()) body = JSON.parse(txt) as BodyJson
    } catch {
      body = null
    }
    const strategy = await resolveStrategyFromRequest(body)

    const cwd = process.cwd()
    const py = resolvePythonExecutable()
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONPATH: cwd,
      ...getSchedulerEnvOverrides(),
      SCRAPER_CALENDAR_RANGE_START: strategy.dateRangeStartYmd,
      SCRAPER_CALENDAR_RANGE_END: strategy.dateRangeEndYmd,
      SCRAPER_BATCH_MODE: strategy.mode,
    }
    const bearer = getAdminServiceBearerSecret()
    if (bearer && !(env.ADMIN_BYPASS_SECRET ?? '').trim()) {
      env.ADMIN_BYPASS_SECRET = bearer
    }

    if (!tryAcquireCalendarPriceBatchLock()) {
      return NextResponse.json({ ok: false, error: '가격 동기화가 이미 실행 중입니다.' }, { status: 409 })
    }

    if (stream) {
      logStream.clear()
      const child = spawn(py, ['-m', 'scripts.calendar_price_scheduler', '--once'], {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const streamGate = tryBeginStreamRun(child)
      if (!streamGate.ok) {
        child.kill('SIGTERM')
        releaseCalendarPriceBatchLock()
        return NextResponse.json({ ok: false, error: streamGate.error }, { status: streamGate.status })
      }
      const onData = (chunk: Buffer | string, isStderr: boolean) => {
        const text = (typeof chunk === 'string' ? chunk : chunk.toString('utf8')).trim()
        if (!text) return
        text.split('\n').forEach((line) => {
          const trimmed = line.trim()
          if (trimmed) {
            logStream.trySetCurrentProductIdFromLine(trimmed)
            logStream.append(trimmed)
          }
        })
      }
      child.stdout?.on('data', (chunk) => onData(chunk, false))
      child.stderr?.on('data', (chunk) => onData(chunk, true))
      child.on('error', (err) => {
        logStream.append(`[ERROR] Process error: ${err.message}`)
      })
      child.on('exit', (code, signal) => {
        logStream.append(`[INFO] Process exited code=${code} signal=${signal ?? 'none'}`)
      })
      attachCalendarBatchFinalizeOnExit(child, strategy)
      child.unref()
      return NextResponse.json({
        ok: true,
        message: '가격 동기화 배치를 시작했습니다. 로그는 실시간 터미널에서 확인하세요.',
        dateRangeStartYmd: strategy.dateRangeStartYmd,
        dateRangeEndYmd: strategy.dateRangeEndYmd,
        mode: strategy.mode,
      })
    }

    const child = spawn(py, ['-m', 'scripts.calendar_price_scheduler', '--once'], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    attachCalendarBatchFinalizeOnExit(child, strategy)
    child.unref()
    return NextResponse.json({
      ok: true,
      message: '가격 동기화 배치를 백그라운드에서 시작했습니다. 완료까지 수 분~수십 분 걸릴 수 있습니다.',
      dateRangeStartYmd: strategy.dateRangeStartYmd,
      dateRangeEndYmd: strategy.dateRangeEndYmd,
      mode: strategy.mode,
    })
  } catch (e) {
    console.error('scheduler run-once:', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
