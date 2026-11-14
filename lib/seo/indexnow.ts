/**
 * IndexNow 알림 — 상품 등록·수정·삭제 시 바뀐 공개 URL 을 Bing·Naver·Yandex·Seznam 등에 알린다.
 * Google Indexing API 는 쓰지 않는다(채용·라이브 영상 전용 정책).
 *
 * REGRESSION-FREEZE[seo-indexnow-skip-on-failure]: 절대 throw·대기하지 않음. 키 없음/실패 = SKIP 로그만 — manifest
 * - 키: 저장소의 공개 키 `INDEXNOW_PUBLIC_KEY` = `public/<key>.txt` (env 불필요).
 *   테스트만 `INDEXNOW_KEY` 를 넘기면 그 값을 쓰고, 빈 문자열이면 SKIP.
 * - 간격: 묶음 전송(디바운스) + 직전 전송과 최소 간격 + 지터. 한 요청 최대 500건. 재시도는 최대 1회. 그래도 실패하면 SKIP.
 * - 운영에서만 전송: NODE_ENV=production 이고 RAILWAY_ENVIRONMENT 또는 VERCEL_ENV 가 production 이며 CI 가 아니고 origin 이 https 공개 호스트.
 */
import { getSiteOrigin } from '@/lib/site-metadata'

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
/** 공개 키 (public/<key>.txt 와 같은 값). env 없이 동작한다. */
export const INDEXNOW_PUBLIC_KEY = '390ef6b3bc14abdd0c900efd20618788'

/** keyLocation 경로. 같은 내용의 `/indexnow-key.txt` 라우트도 둔다. */
export function indexNowKeyLocationPath(key: string = INDEXNOW_PUBLIC_KEY): string {
  return `/${key}.txt`
}

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
  maxUrlsPerRequest: 500,
} as const

/**
 * 키가 명시되면 그 값(빈 값·형식 오류는 null = SKIP). 없으면 저장소 공개 키.
 * REGRESSION-FREEZE[seo-indexnow-public-key]: 운영 키는 public/<key>.txt — manifest
 */
export function resolveIndexNowKey(env: Record<string, string | undefined> = process.env): string | null {
  if (Object.prototype.hasOwnProperty.call(env, 'INDEXNOW_KEY')) {
    const k = (env.INDEXNOW_KEY ?? '').trim()
    return KEY_RE.test(k) ? k : null
  }
  return KEY_RE.test(INDEXNOW_PUBLIC_KEY) ? INDEXNOW_PUBLIC_KEY : null
}

/** CI·로컬·비운영에서는 호출하지 않는다. 새 env 없이 기존 RAILWAY_ENVIRONMENT / VERCEL_ENV / CI / NODE_ENV. */
export function isIndexNowProductionRuntime(env: Record<string, string | undefined> = process.env): boolean {
  if (env.CI === 'true' || env.CI === '1') return false
  if (env.NODE_ENV !== 'production') return false
  return env.RAILWAY_ENVIRONMENT === 'production' || env.VERCEL_ENV === 'production'
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
      log('SKIP no_key', { count: list.length })
      return { status: 'skip', reason: 'no_key', count: list.length }
    }
    if (!isIndexNowProductionRuntime(env)) {
      log('SKIP not_production', { count: list.length })
      return { status: 'skip', reason: 'not_production', count: list.length }
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
      keyLocation: `${origin}${indexNowKeyLocationPath(key)}`,
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
      ;(deps.log ?? defaultLog)('SKIP no_key', { count: urls.length })
      return
    }
    if (!isIndexNowProductionRuntime(env)) {
      ;(deps.log ?? defaultLog)('SKIP not_production', { count: urls.length })
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
