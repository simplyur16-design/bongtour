import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { requireAdmin } from '@/lib/require-admin'
import * as logStream from '@/lib/admin-log-stream'
import { getSchedulerEnvOverrides } from '@/lib/scheduler-config'
import { tryBeginDetachedRun, tryBeginStreamRun } from '@/lib/scheduler-run-once-gate'

/**
 * POST /api/admin/scheduler/run-once. 인증: 관리자.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const stream = searchParams.get('stream') === '1'
    const cwd = process.cwd()
    const env = { ...process.env, PYTHONPATH: cwd, ...getSchedulerEnvOverrides() }

    if (stream) {
      logStream.clear()
      const child = spawn(
        'python',
        ['-m', 'scripts.calendar_price_scheduler', '--once'],
        {
          cwd,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )
      const streamGate = tryBeginStreamRun(child)
      if (!streamGate.ok) {
        child.kill('SIGTERM')
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
      child.unref()
      return NextResponse.json({
        ok: true,
        message: '가격 동기화 배치를 시작했습니다. 로그는 실시간 터미널에서 확인하세요.',
      })
    }

    const detachedGate = tryBeginDetachedRun()
    if (!detachedGate.ok) {
      return NextResponse.json({ ok: false, error: detachedGate.error }, { status: detachedGate.status })
    }

    const child = spawn(
      'python',
      ['-m', 'scripts.calendar_price_scheduler', '--once'],
      {
        cwd,
        env,
        detached: true,
        stdio: 'ignore',
      }
    )
    child.unref()
    return NextResponse.json({
      ok: true,
      message: '가격 동기화 배치를 백그라운드에서 시작했습니다. 완료까지 수 분~수십 분 걸릴 수 있습니다.',
    })
  } catch (e) {
    console.error('scheduler run-once:', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
