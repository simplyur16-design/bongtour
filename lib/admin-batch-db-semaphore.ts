/**
 * 달력 배치·calendar-prices 등 무거운 admin DB 쓰기 — 단일 Railway web 프로세스에서
 * Supabase pooler(P1001) 포화를 막기 위해 동시 1건만 허용.
 */
let active = 0
const waiters: Array<() => void> = []

function maxConcurrent(): number {
  const raw = process.env.BONGTOUR_ADMIN_BATCH_DB_MAX_CONCURRENT?.trim()
  if (raw) {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 1 && n <= 3) return n
  }
  return 1
}

function release(): void {
  active = Math.max(0, active - 1)
  const next = waiters.shift()
  if (next) next()
}

function acquire(): Promise<void> {
  if (active < maxConcurrent()) {
    active += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      active += 1
      resolve()
    })
  })
}

export async function withAdminBatchDbSlot<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now()
  await acquire()
  try {
    return await fn()
  } finally {
    release()
    const ms = Date.now() - t0
    if (ms > 8000) {
      console.log(`[admin-batch-db] slot released label=${label} heldMs=${ms}`)
    }
  }
}
