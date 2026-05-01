/** 달력 가격 배치(스폰) 동시 1회만 — instrumentation cron·run-once 공통 */

type Gate = { running: boolean }

function gate(): Gate {
  const g = globalThis as typeof globalThis & { __bongtourCalendarBatchLock?: Gate }
  if (!g.__bongtourCalendarBatchLock) {
    g.__bongtourCalendarBatchLock = { running: false }
  }
  return g.__bongtourCalendarBatchLock
}

export function isCalendarPriceBatchRunning(): boolean {
  return gate().running
}

export function tryAcquireCalendarPriceBatchLock(): boolean {
  const g = gate()
  if (g.running) return false
  g.running = true
  return true
}

export function releaseCalendarPriceBatchLock(): void {
  gate().running = false
}
