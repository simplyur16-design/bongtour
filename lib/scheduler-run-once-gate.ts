import type { ChildProcess } from 'child_process'

/** 백그라운드(detached) run-once 연타 시 중복 스폰 완화 */
const DETACHED_COOLDOWN_MS = 90_000

type RunOnceGate = {
  streamChild: ChildProcess | null
  lastDetachedAt: number
}

function getGate(): RunOnceGate {
  const g = globalThis as typeof globalThis & { __bongtourSchedulerRunOnceGate?: RunOnceGate }
  if (!g.__bongtourSchedulerRunOnceGate) {
    g.__bongtourSchedulerRunOnceGate = { streamChild: null, lastDetachedAt: 0 }
  }
  return g.__bongtourSchedulerRunOnceGate
}

export function tryBeginStreamRun(child: ChildProcess): { ok: true } | { ok: false; status: 409; error: string } {
  const gate = getGate()
  if (gate.streamChild && !gate.streamChild.killed) {
    return { ok: false, status: 409, error: '가격 동기화가 이미 실행 중입니다.' }
  }
  gate.streamChild = child
  const release = () => {
    if (gate.streamChild === child) gate.streamChild = null
  }
  child.on('exit', release)
  child.on('error', release)
  return { ok: true }
}

export function tryBeginDetachedRun(): { ok: true } | { ok: false; status: 409 | 429; error: string } {
  const gate = getGate()
  if (gate.streamChild && !gate.streamChild.killed) {
    return { ok: false, status: 409, error: '가격 동기화가 이미 실행 중입니다.' }
  }
  const elapsed = Date.now() - gate.lastDetachedAt
  if (gate.lastDetachedAt > 0 && elapsed < DETACHED_COOLDOWN_MS) {
    const sec = Math.ceil((DETACHED_COOLDOWN_MS - elapsed) / 1000)
    return { ok: false, status: 429, error: `배치 실행 간격을 주세요. (${sec}초 후 재시도)` }
  }
  gate.lastDetachedAt = Date.now()
  return { ok: true }
}
