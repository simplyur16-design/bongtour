import {
  supplierFetch,
  SupplierFetchError,
  type SupplierFetchFailure,
  type SupplierFetchRetryPolicy,
} from '@/lib/supplier-http/supplier-fetch'

/**
 * 한진관광(hanjintravel.com) 전용 HTTP — 공개 화면이 쓰는 JSON API(/api/v1/dp/...)를 비로그인으로 순차 호출.
 * 간격·타임아웃·재시도는 이 모듈 상수만 쓴다(공급사 간 공통 설정 금지).
 * REGRESSION-FREEZE[hanjintour-supplier-collect]: 순차·간격+지터·재시도 1회·403/429 즉시 중단 — manifest
 */
export const HANJINTOUR_API_BASE = process.env.HANJINTOUR_API_BASE_URL ?? 'https://www.hanjintravel.com'
export const HANJINTOUR_SITE_NO = '1000000010'
export const HANJINTOUR_SITE_CD = 'SITE_TP_001'

export const HANJINTOUR_FETCH_TIMEOUT_MS = 20_000
/** 호출 사이 최소 간격 + 지터 (사람이 목록·상세를 넘기는 속도). */
export const HANJINTOUR_CALL_GAP_MS = 2_500
export const HANJINTOUR_CALL_JITTER_MS = 1_500
export const HANJINTOUR_FETCH_RETRY: SupplierFetchRetryPolicy = {
  maxRetries: 1,
  baseDelayMs: 5_000,
  jitterMs: 2_500,
  maxRetryAfterMs: 30_000,
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

export class HanjintourBlockedError extends Error {
  constructor(readonly status: number, readonly part: string) {
    super(`hanjintour_blocked status=${status} part=${part}`)
    this.name = 'HanjintourBlockedError'
  }
}

export type HanjintourClientDeps = {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

export type HanjintourCallLog = { part: string; path: string; status: number | null; ok: boolean; errorKind?: string; at: string }

/** 순차 호출 클라이언트: 동시 호출 없음(직렬 큐), 매 호출 전 간격+지터, 차단 신호(403/429) 뒤에는 더 호출하지 않는다. */
export function createHanjintourClient(deps: HanjintourClientDeps = {}) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const random = deps.random ?? Math.random
  let chain: Promise<unknown> = Promise.resolve()
  let blocked: HanjintourBlockedError | null = null
  let calls = 0
  const log: HanjintourCallLog[] = []

  async function run<T>(part: string, method: 'GET' | 'POST', path: string, data: Record<string, unknown> | null): Promise<T> {
    if (blocked) throw blocked
    if (calls > 0) await sleep(HANJINTOUR_CALL_GAP_MS + Math.floor(random() * HANJINTOUR_CALL_JITTER_MS))
    calls++
    let url = HANJINTOUR_API_BASE + path
    if (method === 'GET' && data) {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(data)) if (v != null) qs.set(k, String(v))
      url += `?${qs.toString()}`
    }
    const r = await supplierFetch({
      supplier: 'hanjintour',
      part,
      url,
      init: {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'accept-language': 'ko-KR',
          'user-agent': UA,
          authorization: 'Bearer ',
          origin: 'https://www.hanjintravel.com',
          referer: 'https://www.hanjintravel.com/',
        },
        ...(method === 'POST' ? { body: JSON.stringify(data ?? {}) } : {}),
      },
      timeoutMs: HANJINTOUR_FETCH_TIMEOUT_MS,
      idempotent: true,
      retry: HANJINTOUR_FETCH_RETRY,
      fetchImpl: deps.fetchImpl,
      sleep,
      random,
    })
    log.push({ part, path, status: r.status, ok: r.ok, errorKind: r.ok ? undefined : r.errorKind, at: new Date().toISOString() })
    if (!r.ok) {
      if (r.status === 403 || r.status === 429) {
        blocked = new HanjintourBlockedError(r.status, part)
        throw blocked
      }
      throw new SupplierFetchError(r as SupplierFetchFailure)
    }
    return JSON.parse(r.body.toString('utf8')) as T
  }

  function call<T>(part: string, method: 'GET' | 'POST', path: string, data: Record<string, unknown> | null = null): Promise<T> {
    const p = chain.then(() => run<T>(part, method, path, data))
    chain = p.catch(() => undefined)
    return p
  }

  return { call, log, isBlocked: () => blocked !== null, callCount: () => calls }
}

export type HanjintourClient = ReturnType<typeof createHanjintourClient>
