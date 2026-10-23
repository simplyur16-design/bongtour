/**
 * Solapi 발송 직렬 큐 — eSIM 문자가 문의/관리자 알림에 밀리지 않게 우선순위 적용.
 * REGRESSION-FREEZE[bongsim-solapi-esim-priority-queue]: eSIM priority Solapi queue — manifest
 */

export type SolapiSendPriority = 'esim' | 'normal'

type QueueJob<T> = {
  priority: SolapiSendPriority
  run: () => Promise<T>
  resolve: (v: T) => void
  reject: (e: unknown) => void
}

const GAP_MS = Math.max(
  200,
  Number.parseInt(process.env.BONGSIM_SOLAPI_SEND_GAP_MS ?? '400', 10) || 400,
)

const esimQ: QueueJob<unknown>[] = []
const normalQ: QueueJob<unknown>[] = []
let draining = false

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function pump(): Promise<void> {
  if (draining) return
  draining = true
  try {
    while (esimQ.length > 0 || normalQ.length > 0) {
      const job = (esimQ.shift() ?? normalQ.shift())!
      try {
        const v = await job.run()
        job.resolve(v)
      } catch (e) {
        job.reject(e)
      }
      if (esimQ.length > 0 || normalQ.length > 0) {
        await sleep(GAP_MS)
      }
    }
  } finally {
    draining = false
    if (esimQ.length > 0 || normalQ.length > 0) {
      void pump()
    }
  }
}

/** eSIM 발송은 `priority: 'esim'` — 문의/예약 알림보다 먼저 처리 */
export function enqueueSolapiSend<T>(
  priority: SolapiSendPriority,
  run: () => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const job: QueueJob<T> = { priority, run, resolve, reject }
    if (priority === 'esim') esimQ.push(job as QueueJob<unknown>)
    else normalQ.push(job as QueueJob<unknown>)
    void pump()
  })
}

/** 테스트용 */
export function __solapiQueueDepthForTest(): { esim: number; normal: number; draining: boolean } {
  return { esim: esimQ.length, normal: normalQ.length, draining }
}
