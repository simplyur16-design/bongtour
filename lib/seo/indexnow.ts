/**
 * IndexNow 알림 — 상품 등록·수정·삭제 시 바뀐 공개 URL 을 Bing·Naver·Yandex·Seznam 등에 알린다.
 * Google Indexing API 는 쓰지 않는다(채용·라이브 영상 전용 정책).
 *
 * REGRESSION-FREEZE[seo-indexnow-skip-on-failure]: 절대 throw·대기하지 않음. 키 없음/실패 = SKIP 로그만 — manifest
 * - 키: `INDEXNOW_KEY` (8~128자 [A-Za-z0-9-]). 없으면 전부 SKIP(no-op), 키 파일 라우트도 404.
 * - 간격: 묶음 전송(디바운스) + 직전 전송과 최소 간격 + 지터. 재시도는 최대 1회. 그래도 실패하면 SKIP.
 * - 운영 origin(https, localhost 아님)일 때만 전송.
 */
import { getSiteOrigin } from '@/lib/site-metadata'

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
/** 키 파일 — `app/indexnow-key.txt/route.ts` (keyLocation 으로 전달) */
export const INDEXNOW_KEY_FILE_PATH = '/indexnow-key.txt'

const KEY_RE = /^[A-Za-z0-9-]{8,128}$/

export type IndexNowResult =
  | { status: 'sent'; count: number; httpStatus: number; attempts: number }
  | { status: 'skip'; reason: string; count: number; attempts?: number }

export type IndexNowDeps = {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  now?: () => number
  env?: Record<string, string | undefined>
  origin?: string
  log?: (msg: string, extra?: Record<string, unknown>) => void
}

export const INDEXNOW_TIMING = {
  /** 이벤트 묶음 대기 */
  debounceMs: 4_000,
  /** 직전 전송과 최소 간격 */
  minIntervalMs: 10_000,
  /** 0~jitterMs 무작위 추가 */
  jitterMs: 3_000,
  /** 1회 재시도 전 대기 */
  retryDelayMs: 5_000,
  timeoutMs: 5_000,
  /** IndexNow 1회 최대 10,000 — 여유 있게 */
  maxUrlsPerRequest: 1_000,
} as const

export function resolveIndexNowKey(env: Record<string, string | undefined> = process.env): string | null {
  const k = (env.INDEXNOW_KEY ?? '').trim()
  return KEY_RE.test(k) ? k : null
}

/** 운영 공개 origin 만 — localhost·http·IP 는 SKIP */
export function isIndexNowEligibleOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    if (u.protocol !== 'https:') return false
    const h = u.hostname
    if (h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.endsWith('.local')) return false
    return true
  } catch {
    return false
  }
}

/** 같은 host 의 절대 URL 만, 중복 제거 */
export function filterIndexNowUrls(urls: readonly string[], origin: string): string[] {
  let host: string
  try {
    host = new URL(origin).host
  } catch {
    return []
  }
  const out = new Set<string>()
  for (const raw of urls) {
    try {
      const u = new URL(raw, origin)
      if (u.host !== host) continue
      u.hash = ''
      out.add(u.toString())
    } catch {
      /* skip */
    }
  }
  return [...out]
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const defaultLog = (msg: string, extra?: Record<string, unknown>) => console.info(`[indexnow] ${msg}`, extra ?? '')

/**
 * 즉시 1건 전송(재시도 최대 1회). 큐·간격은 `queueIndexNowUrls` 가 담당.
 * 절대 throw 하지 않는다.
 */
export async function submitIndexNow(urls: readonly string[], deps: IndexNowDeps = {}): Promise<IndexNowResult> {
  const log = deps.log ?? defaultLog
  try {
    const env = deps.env ?? process.env
    const key = resolveIndexNowKey(env)
    const origin = (deps.origin ?? getSiteOrigin()).replace(/\/$/, '')
    const list = filterIndexNowUrls(urls, origin).slice(0, INDEXNOW_TIMING.maxUrlsPerRequest)
    if (!key) {
      log('SKIP no_key (INDEXNOW_KEY 미설정)', { count: list.length })
      return { status: 'skip', reason: 'no_key', count: list.length }
    }
    if (!isIndexNowEligibleOrigin(origin)) {
      log('SKIP non_production_origin', { origin, count: list.length })
      return { status: 'skip', reason: 'non_production_origin', count: list.length }
    }
    if (list.length === 0) return { status: 'skip', reason: 'no_urls', count: 0 }

    const f = deps.fetchImpl ?? fetch
    const sleep = deps.sleep ?? defaultSleep
    const body = JSON.stringify({
      host: new URL(origin).host,
      key,
      keyLocation: `${origin}${INDEXNOW_KEY_FILE_PATH}`,
      urlList: list,
    })
    let lastReason = 'unknown'
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await f(INDEXNOW_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body,
          signal: AbortSignal.timeout(INDEXNOW_TIMING.timeoutMs),
        })
        // 200 OK, 202 Accepted(키 검증 대기)
        if (res.status === 200 || res.status === 202) {
          log('sent', { count: list.length, status: res.status, attempt })
          return { status: 'sent', count: list.length, httpStatus: res.status, attempts: attempt }
        }
        lastReason = `http_${res.status}`
        // 400/403/422 는 재시도해도 같다 — 바로 SKIP
        if (res.status === 400 || res.status === 403 || res.status === 422) break
      } catch (err) {
        lastReason = err instanceof Error ? `error_${err.name}` : 'error'
      }
      if (attempt === 1) await sleep(INDEXNOW_TIMING.retryDelayMs)
    }
    log(`SKIP failed ${lastReason}`, { count: list.length })
    return { status: 'skip', reason: lastReason, count: list.length, attempts: 2 }
  } catch (err) {
    log('SKIP unexpected', { err: err instanceof Error ? err.message : String(err) })
    return { status: 'skip', reason: 'unexpected', count: urls.length }
  }
}

/* ── 프로세스 내 큐: 디바운스 + 최소 간격 + 지터 ─────────────────────────── */

type QueueState = {
  pending: Set<string>
  timer: ReturnType<typeof setTimeout> | null
  lastSentAt: number
  inFlight: Promise<IndexNowResult> | null
}

const queue: QueueState = { pending: new Set(), timer: null, lastSentAt: 0, inFlight: null }

/** 다음 전송까지 대기(ms) — 디바운스·최소간격·지터 */
export function computeIndexNowDelayMs(nowMs: number, lastSentAt: number, random: () => number = Math.random): number {
  const sinceLast = nowMs - lastSentAt
  const gap = lastSentAt > 0 ? Math.max(0, INDEXNOW_TIMING.minIntervalMs - sinceLast) : 0
  const jitter = Math.floor(Math.max(0, Math.min(1, random())) * INDEXNOW_TIMING.jitterMs)
  return Math.max(INDEXNOW_TIMING.debounceMs, gap) + jitter
}

/**
 * fire-and-forget. 호출측은 await 하지 않는다(등록·수정·삭제 응답을 막지 않음).
 * 키가 없으면 큐에도 넣지 않고 바로 SKIP.
 */
export function queueIndexNowUrls(urls: readonly string[], deps: IndexNowDeps = {}): void {
  try {
    const env = deps.env ?? process.env
    if (!resolveIndexNowKey(env)) {
      ;(deps.log ?? defaultLog)('SKIP no_key (INDEXNOW_KEY 미설정)', { count: urls.length })
      return
    }
    for (const u of urls) if (u) queue.pending.add(u)
    if (queue.timer || queue.pending.size === 0) return
    const now = (deps.now ?? Date.now)()
    const delay = computeIndexNowDelayMs(now, queue.lastSentAt, deps.random)
    queue.timer = setTimeout(() => {
      queue.timer = null
      const batch = [...queue.pending]
      queue.pending.clear()
      queue.lastSentAt = (deps.now ?? Date.now)()
      queue.inFlight = submitIndexNow(batch, deps).finally(() => {
        queue.inFlight = null
        // 전송 중 새로 쌓인 것은 다음 간격에
        if (queue.pending.size > 0) queueIndexNowUrls([], deps)
      })
    }, delay)
    // 서버 종료를 막지 않게
    ;(queue.timer as { unref?: () => void }).unref?.()
  } catch {
    /* never throw */
  }
}

/** 테스트 전용 */
export function __resetIndexNowQueueForTests(): void {
  if (queue.timer) clearTimeout(queue.timer)
  queue.pending.clear()
  queue.timer = null
  queue.lastSentAt = 0
  queue.inFlight = null
}

export function __peekIndexNowQueueForTests(): { pending: string[]; scheduled: boolean } {
  return { pending: [...queue.pending], scheduled: queue.timer != null }
}
