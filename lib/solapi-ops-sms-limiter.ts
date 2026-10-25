/**
 * 내부 배치·운영 알림 Solapi LMS 상한기 (프로세스 메모리).
 * 고객 거래 문자·내부 거래 알림은 이 모듈을 거치지 않는다.
 */

import { sendAdminOperationalLms } from '@/lib/notification-service'

const QUEUE_MAX = 50
const DEDUPE_WINDOW_MS = 10 * 60 * 1000
const RETRY_BACKOFF_MS = [5_000, 30_000] as const

export type OpsSmsKind = string

export type EnqueueOpsSmsResult = {
  queued: boolean
  sent: boolean
  deferred: boolean
  skipped: boolean
  dryRun: boolean
  reason?: string
}

type QueuedItem = {
  kind: OpsSmsKind
  text: string
  enqueuedAt: number
}

type DedupeEntry = {
  kind: OpsSmsKind
  text: string
  at: number
  count: number
}

type LimiterState = {
  minuteBucket: string
  minuteSent: number
  dayKey: string
  daySent: number
  queue: QueuedItem[]
  /** 일일 상한으로 밀린 건 — 다음 날 다이제스트 앞에 붙일 요약 */
  dailyCapDeferred: { kind: OpsSmsKind; count: number }[]
  lastByKind: Map<string, DedupeEntry>
  drainTimer: ReturnType<typeof setTimeout> | null
  draining: boolean
}

const state: LimiterState = {
  minuteBucket: '',
  minuteSent: 0,
  dayKey: '',
  daySent: 0,
  queue: [],
  dailyCapDeferred: [],
  lastByKind: new Map(),
  drainTimer: null,
  draining: false,
}

function parseNonNegInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return fallback
  return n
}

function maxPerMinute(): number {
  return parseNonNegInt(process.env.SOLAPI_OPS_SMS_MAX_PER_MINUTE, 3)
}

function maxPerDay(): number {
  return parseNonNegInt(process.env.SOLAPI_OPS_SMS_MAX_PER_DAY, 20)
}

function retryMax(): number {
  return parseNonNegInt(process.env.SOLAPI_OPS_SMS_RETRY_MAX, 2)
}

function isOpsDryRun(): boolean {
  return process.env.SOLAPI_OPS_SMS_DRY_RUN === '1'
}

/** KST(Asia/Seoul) YYYY-MM-DD */
export function opsSmsKstDayKey(nowMs = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(nowMs))
}

/** KST minute bucket YYYY-MM-DDTHH:mm */
function opsSmsKstMinuteBucket(nowMs = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(nowMs))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function rollCounters(nowMs: number): void {
  const day = opsSmsKstDayKey(nowMs)
  if (state.dayKey !== day) {
    state.dayKey = day
    state.daySent = 0
  }
  const minute = opsSmsKstMinuteBucket(nowMs)
  if (state.minuteBucket !== minute) {
    state.minuteBucket = minute
    state.minuteSent = 0
  }
}

function summarizeOverflow(items: QueuedItem[]): string {
  const byKind = new Map<string, number>()
  for (const it of items) {
    byKind.set(it.kind, (byKind.get(it.kind) ?? 0) + 1)
  }
  const parts = [...byKind.entries()].map(([k, n]) => `${k}×${n}`)
  return `[ops-sms summary] overflow merged: ${parts.join(', ')} (total ${items.length})`
}

function pushQueue(item: QueuedItem): void {
  state.queue.push(item)
  while (state.queue.length > QUEUE_MAX) {
    const overflow: QueuedItem[] = []
    while (state.queue.length > QUEUE_MAX - 1) {
      const oldest = state.queue.shift()
      if (oldest) overflow.push(oldest)
    }
    if (overflow.length > 0) {
      state.queue.unshift({
        kind: 'ops-summary',
        text: summarizeOverflow(overflow),
        enqueuedAt: Date.now(),
      })
    }
  }
}

function recordDailyCapDefer(kind: OpsSmsKind): void {
  const existing = state.dailyCapDeferred.find((d) => d.kind === kind)
  if (existing) existing.count += 1
  else state.dailyCapDeferred.push({ kind, count: 1 })
  const total = state.dailyCapDeferred.reduce((s, d) => s + d.count, 0)
  console.log(
    '[ops-sms] daily-cap',
    JSON.stringify({ kind, deferredKinds: state.dailyCapDeferred.length, deferredTotal: total }),
  )
}

/** 다이제스트에 붙일 일일 상한 밀림 요약. 호출 후 버퍼를 비운다. */
export function takeOpsSmsDailyCapDigestPrefix(): string | null {
  if (state.dailyCapDeferred.length === 0) return null
  const parts = state.dailyCapDeferred.map((d) => `${d.kind}×${d.count}`)
  const total = state.dailyCapDeferred.reduce((s, d) => s + d.count, 0)
  state.dailyCapDeferred = []
  return `ops-sms daily-cap deferred: ${parts.join(', ')} (total ${total})`
}

export function getOpsSmsDailyCapDeferredCount(): number {
  return state.dailyCapDeferred.reduce((s, d) => s + d.count, 0)
}

function tryDedupe(kind: OpsSmsKind, text: string, nowMs: number): boolean {
  const prev = state.lastByKind.get(kind)
  if (!prev) return false
  if (nowMs - prev.at > DEDUPE_WINDOW_MS) return false
  if (prev.text !== text) return false
  prev.count += 1
  prev.at = nowMs
  console.log('[ops-sms] dedupe', JSON.stringify({ kind, count: prev.count }))
  return true
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function sendWithRetry(text: string): Promise<{ ok: boolean; dryRun: boolean }> {
  if (isOpsDryRun()) {
    console.log('[ops-sms] dry_run', JSON.stringify({ len: text.length }))
    return { ok: true, dryRun: true }
  }
  const maxAttempts = 1 + retryMax()
  let lastFailed = false
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await sendAdminOperationalLms(text)
      if (r.skipped) {
        // env 미설정 등은 재시도해도 소용없음
        return { ok: false, dryRun: false }
      }
      if (r.dryRun || r.failed.length === 0) {
        return { ok: true, dryRun: r.dryRun }
      }
      lastFailed = true
    } catch {
      lastFailed = true
    }
    if (attempt < maxAttempts) {
      const backoff = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)]!
      await sleep(backoff)
    }
  }
  if (lastFailed) {
    console.log('[ops-sms] send-failed-after-retries', JSON.stringify({ attempts: maxAttempts }))
  }
  return { ok: false, dryRun: false }
}

async function attemptSendNow(kind: OpsSmsKind, text: string, nowMs: number): Promise<EnqueueOpsSmsResult> {
  rollCounters(nowMs)
  const perMin = maxPerMinute()
  const perDay = maxPerDay()

  // 상한 0 = 운영 문자 끔 → 다이제스트에만 쌓음
  if (perMin === 0 || perDay === 0) {
    recordDailyCapDefer(kind)
    return { queued: false, sent: false, deferred: true, skipped: true, dryRun: false, reason: 'cap-zero' }
  }

  if (state.daySent >= perDay) {
    recordDailyCapDefer(kind)
    return { queued: false, sent: false, deferred: true, skipped: true, dryRun: false, reason: 'daily-cap' }
  }

  if (state.minuteSent >= perMin) {
    pushQueue({ kind, text, enqueuedAt: nowMs })
    scheduleDrain()
    return { queued: true, sent: false, deferred: true, skipped: false, dryRun: false, reason: 'minute-cap' }
  }

  const r = await sendWithRetry(text)
  if (r.ok) {
    state.minuteSent += 1
    state.daySent += 1
    state.lastByKind.set(kind, { kind, text, at: nowMs, count: 1 })
    return { queued: false, sent: true, deferred: false, skipped: false, dryRun: r.dryRun }
  }

  // 실패 후 포기 → 요약에 남김
  recordDailyCapDefer(kind)
  return { queued: false, sent: false, deferred: true, skipped: false, dryRun: false, reason: 'send-failed' }
}

function scheduleDrain(): void {
  if (state.drainTimer != null) return
  // 다음 분 경계에 가깝게 재시도 (테스트: fake timer advance)
  state.drainTimer = setTimeout(() => {
    state.drainTimer = null
    void drainQueue()
  }, 1_000)
}

async function drainQueue(): Promise<void> {
  if (state.draining) return
  state.draining = true
  try {
    while (state.queue.length > 0) {
      rollCounters(Date.now())
      const perMin = maxPerMinute()
      const perDay = maxPerDay()
      if (perMin === 0 || perDay === 0 || state.daySent >= perDay) {
        // 일일 상한이면 큐 잔여를 다이제스트로
        while (state.queue.length > 0) {
          const it = state.queue.shift()!
          recordDailyCapDefer(it.kind)
        }
        break
      }
      if (state.minuteSent >= perMin) {
        scheduleDrain()
        break
      }
      const item = state.queue.shift()!
      const r = await sendWithRetry(item.text)
      if (r.ok) {
        state.minuteSent += 1
        state.daySent += 1
        state.lastByKind.set(item.kind, {
          kind: item.kind,
          text: item.text,
          at: Date.now(),
          count: 1,
        })
      } else {
        recordDailyCapDefer(item.kind)
      }
    }
  } finally {
    state.draining = false
  }
}

/**
 * 내부 배치·운영 알림 1건을 상한기 경유로 보낸다.
 * 실제 발송은 `sendAdminOperationalLms` → 공용 큐(`enqueueSolapiSend('normal')`).
 */
export async function enqueueOpsSms(opts: {
  kind: OpsSmsKind
  text: string
}): Promise<EnqueueOpsSmsResult> {
  const nowMs = Date.now()
  const kind = opts.kind.trim() || 'ops'
  const text = opts.text

  if (tryDedupe(kind, text, nowMs)) {
    return { queued: false, sent: false, deferred: false, skipped: true, dryRun: false, reason: 'dedupe' }
  }

  return attemptSendNow(kind, text, nowMs)
}

/** 테스트용 상태 초기화 */
export function __resetOpsSmsLimiterForTest(): void {
  if (state.drainTimer != null) {
    clearTimeout(state.drainTimer)
    state.drainTimer = null
  }
  state.minuteBucket = ''
  state.minuteSent = 0
  state.dayKey = ''
  state.daySent = 0
  state.queue = []
  state.dailyCapDeferred = []
  state.lastByKind.clear()
  state.draining = false
}

/** 테스트용 큐 깊이 */
export function __opsSmsLimiterQueueDepthForTest(): number {
  return state.queue.length
}

/** 테스트용 분/일 카운터 */
export function __opsSmsLimiterCountersForTest(): {
  minuteSent: number
  daySent: number
  dayKey: string
} {
  return { minuteSent: state.minuteSent, daySent: state.daySent, dayKey: state.dayKey }
}
