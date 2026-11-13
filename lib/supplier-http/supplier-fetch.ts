/**
 * 공급사 외부 HTTP 호출 래퍼 — 타임아웃·HTTP 상태 확인·실패 분류·시도 기록.
 *
 * 간격·타임아웃·재시도 대기값의 기본값은 두지 않는다. 각 공급사 모듈이 자기 상수를 넘긴다
 * (공급사 간 공통 스크래퍼 설정 금지 원칙).
 *
 * REGRESSION-FREEZE[supplier-fetch-resilience]: 조회성 요청만 최대 1회 재시도·4xx 재시도 없음·실패 무음 금지 — manifest
 */

export type SupplierFetchErrorKind =
  | 'timeout'
  | 'conn_reset'
  | 'conn_fail'
  | 'http_5xx'
  | 'http_429'
  | 'http_4xx'

/** 외부 장애로 보고 재시도·live-gate SKIP 대상이 되는 실패 종류 (4xx 제외). */
export const SUPPLIER_FETCH_TRANSIENT_KINDS: ReadonlySet<SupplierFetchErrorKind> = new Set([
  'timeout',
  'conn_reset',
  'conn_fail',
  'http_5xx',
  'http_429',
])

export type SupplierFetchRetryPolicy = {
  /** 0 또는 1. 조회성(idempotent) 요청에서만 적용. */
  maxRetries: 0 | 1
  /** 재시도 전 최소 대기(ms) — 공급사 모듈 상수. */
  baseDelayMs: number
  /** 0..jitterMs 무작위 추가 대기. */
  jitterMs: number
  /** 429 Retry-After가 이 값을 넘으면 재시도하지 않는다. */
  maxRetryAfterMs: number
}

export type SupplierFetchOptions = {
  supplier: string
  /** 로그·SKIP 사유용 구간 이름 (예: view, tab0, tab1, program_list). */
  part: string
  url: string
  init?: Omit<RequestInit, 'signal'>
  timeoutMs: number
  /** 조회성 요청만 true. false면 재시도하지 않는다. */
  idempotent: boolean
  retry: SupplierFetchRetryPolicy
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  now?: () => number
}

export type SupplierFetchAttempt = {
  attempt: number
  status: number | null
  errorKind: SupplierFetchErrorKind | null
  elapsedMs: number
}

type SupplierFetchBase = {
  supplier: string
  part: string
  /** 쿼리 문자열 제거한 URL (로그·요약용). */
  url: string
  attempts: SupplierFetchAttempt[]
  elapsedMs: number
}

export type SupplierFetchSuccess = SupplierFetchBase & {
  ok: true
  status: number
  headers: Headers
  body: Buffer
}

export type SupplierFetchFailure = SupplierFetchBase & {
  ok: false
  status: number | null
  errorKind: SupplierFetchErrorKind
  message: string
}

export type SupplierFetchResult = SupplierFetchSuccess | SupplierFetchFailure

export class SupplierFetchError extends Error {
  readonly failure: SupplierFetchFailure
  constructor(failure: SupplierFetchFailure) {
    super(
      `supplier_fetch_failed supplier=${failure.supplier} part=${failure.part} kind=${failure.errorKind} ` +
        `status=${failure.status ?? '-'} attempts=${failure.attempts.length} elapsedMs=${failure.elapsedMs} url=${failure.url}`,
    )
    this.name = 'SupplierFetchError'
    this.failure = failure
  }
}

export function isSupplierFetchError(e: unknown): e is SupplierFetchError {
  return e instanceof SupplierFetchError
}

export function supplierFetchUrlForLog(url: string): string {
  const i = url.search(/[?#]/)
  return i >= 0 ? url.slice(0, i) : url
}

function errorCode(e: unknown): string {
  if (!e || typeof e !== 'object') return ''
  const o = e as { code?: unknown; name?: unknown; cause?: unknown }
  const own = typeof o.code === 'string' ? o.code : ''
  if (own) return own
  if (o.cause && typeof o.cause === 'object') {
    const c = (o.cause as { code?: unknown }).code
    if (typeof c === 'string') return c
  }
  return ''
}

/** fetch가 던진 예외 → 실패 종류. */
export function classifySupplierFetchThrown(e: unknown): SupplierFetchErrorKind {
  const name = e && typeof e === 'object' ? String((e as { name?: unknown }).name ?? '') : ''
  if (name === 'TimeoutError' || name === 'AbortError') return 'timeout'
  const code = errorCode(e).toUpperCase()
  if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'UND_ERR_BODY_TIMEOUT' || code === 'ETIMEDOUT') {
    return 'timeout'
  }
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET' || code === 'EPIPE' || code === 'ECONNABORTED') {
    return 'conn_reset'
  }
  return 'conn_fail'
}

export function classifySupplierHttpStatus(status: number): SupplierFetchErrorKind | null {
  if (status >= 200 && status < 400) return null
  if (status === 429) return 'http_429'
  if (status >= 500) return 'http_5xx'
  return 'http_4xx'
}

/** Retry-After 헤더 → ms. 없거나 해석 불가면 null. */
export function parseRetryAfterMs(raw: string | null | undefined, nowMs: number): number | null {
  const v = String(raw ?? '').trim()
  if (!v) return null
  if (/^\d+$/.test(v)) return Number(v) * 1000
  const at = Date.parse(v)
  if (!Number.isFinite(at)) return null
  return Math.max(0, at - nowMs)
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function supplierFetch(opts: SupplierFetchOptions): Promise<SupplierFetchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const sleep = opts.sleep ?? defaultSleep
  const random = opts.random ?? Math.random
  const now = opts.now ?? Date.now
  const maxAttempts = opts.idempotent ? 1 + opts.retry.maxRetries : 1
  const attempts: SupplierFetchAttempt[] = []
  const startedAt = now()
  const logUrl = supplierFetchUrlForLog(opts.url)
  let lastFailure: SupplierFetchFailure | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const t0 = now()
    let retryAfterMs: number | null = null
    try {
      const res = await fetchImpl(opts.url, { ...opts.init, signal: AbortSignal.timeout(opts.timeoutMs) })
      const kind = classifySupplierHttpStatus(res.status)
      if (kind == null) {
        const body = Buffer.from(await res.arrayBuffer())
        attempts.push({ attempt, status: res.status, errorKind: null, elapsedMs: now() - t0 })
        return {
          ok: true,
          supplier: opts.supplier,
          part: opts.part,
          url: logUrl,
          status: res.status,
          headers: res.headers,
          body,
          attempts,
          elapsedMs: now() - startedAt,
        }
      }
      if (kind === 'http_429') retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'), now())
      await res.arrayBuffer().catch(() => undefined)
      attempts.push({ attempt, status: res.status, errorKind: kind, elapsedMs: now() - t0 })
      lastFailure = {
        ok: false,
        supplier: opts.supplier,
        part: opts.part,
        url: logUrl,
        status: res.status,
        errorKind: kind,
        message: `HTTP ${res.status}`,
        attempts,
        elapsedMs: now() - startedAt,
      }
    } catch (e) {
      const kind = classifySupplierFetchThrown(e)
      attempts.push({ attempt, status: null, errorKind: kind, elapsedMs: now() - t0 })
      lastFailure = {
        ok: false,
        supplier: opts.supplier,
        part: opts.part,
        url: logUrl,
        status: null,
        errorKind: kind,
        message: e instanceof Error ? e.message : String(e),
        attempts,
        elapsedMs: now() - startedAt,
      }
    }

    const canRetry = attempt < maxAttempts && SUPPLIER_FETCH_TRANSIENT_KINDS.has(lastFailure.errorKind)
    if (!canRetry) break
    const jitter = Math.floor(random() * Math.max(0, opts.retry.jitterMs))
    let waitMs = opts.retry.baseDelayMs + jitter
    if (lastFailure.errorKind === 'http_429' && retryAfterMs != null) {
      if (retryAfterMs > opts.retry.maxRetryAfterMs) break
      waitMs = Math.max(waitMs, retryAfterMs)
    }
    console.warn(
      '[supplierFetch] retry',
      JSON.stringify({
        supplier: opts.supplier,
        part: opts.part,
        url: logUrl,
        kind: lastFailure.errorKind,
        attempt,
        waitMs,
      }),
    )
    await sleep(waitMs)
  }

  const failure: SupplierFetchFailure = { ...lastFailure!, attempts, elapsedMs: now() - startedAt }
  console.warn(
    '[supplierFetch] failed',
    JSON.stringify({
      supplier: failure.supplier,
      part: failure.part,
      url: failure.url,
      kind: failure.errorKind,
      status: failure.status,
      attempts: failure.attempts.length,
      elapsedMs: failure.elapsedMs,
    }),
  )
  return failure
}
