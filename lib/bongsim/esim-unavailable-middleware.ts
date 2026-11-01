import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  BONGSIM_SELLABLE_API_PATH,
  esimProductOptionIdFromPath,
  isWellFormedOptionApiId,
  normalizeEsimDestinationCode,
} from '@/lib/bongsim/catalog/esim-sellable-visibility'

/**
 * REGRESSION-FREEZE[bongsim-esim-hide-unavailable]: 판매 불가 eSIM 상품·국가 URL → 진짜 HTTP 404 — manifest
 *
 * 왜 middleware인가: 루트 `app/loading.tsx`(Suspense) 아래에서는 페이지의 notFound()가
 * 스트리밍 후라 상태코드 200(soft 404)으로 나감. 응답 시작 전에 판정하려면 middleware뿐.
 * recommend 페이지는 force-static(서버 searchParams 금지)이라 국가 판정도 여기서만 가능.
 *
 * Edge 런타임 — DB 직접 접근 불가 → `/api/bongsim/sellable` 조회(짧은 타임아웃 + 메모리 캐시).
 * 판정 실패·타임아웃은 null → 기존 렌더 그대로(fail-open). 확실히 판매 불가일 때만 404.
 */

const CHECK_TIMEOUT_MS = 1500
const CACHE_TTL_MS = 60_000
const CACHE_MAX = 2000

const cache = new Map<string, { sellable: boolean; exp: number }>()

function cacheGet(key: string): boolean | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.exp < Date.now()) {
    cache.delete(key)
    return null
  }
  return hit.sellable
}

function cacheSet(key: string, sellable: boolean) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value
    if (first !== undefined) cache.delete(first)
  }
  cache.set(key, { sellable, exp: Date.now() + CACHE_TTL_MS })
}

/**
 * 판정 조회 origin — env override 가 있으면 그 값, 없으면 같은 프로세스의 Node 서버(`next start -p $PORT`)에 http 로 직접.
 *
 * `req.nextUrl.origin` 을 쓰면 안 됨: next start 는 initURL 을 `${protocol}://localhost:${port}` 로 만들고
 * protocol 은 `x-forwarded-proto` 가 https 면 https — Railway 프록시 뒤에서는 `https://localhost:<PORT>` 가 되어
 * 평문 HTTP 서버에 TLS 로 붙다가 바로 실패 → null(fail-open) → 판매 불가 페이지가 200 으로 남았음 (2026-11-01 라이브 확인).
 * `/products/*` 308·404 판정(lib/product-path-status)과 같은 방식.
 */
export function esimSellableCheckOrigin(envOrigin: string | undefined, port: string | undefined): string {
  const fromEnv = (envOrigin ?? '').trim().replace(/\/+$/, '')
  if (/^https?:\/\/[^\s/]+$/i.test(fromEnv)) return fromEnv
  const p = (port ?? '').trim()
  return `http://127.0.0.1:${/^\d{1,5}$/.test(p) ? p : '3000'}`
}

function sellableCheckOrigin(): string {
  return esimSellableCheckOrigin(process.env.BONGSIM_SELLABLE_CHECK_ORIGIN, process.env.PORT)
}

/** 판정 대상 쿼리(option= / country=) — 대상 아님이면 null, 형식상 불가면 'invalid' */
export function esimSellableQueryForRequest(
  pathname: string,
  searchParams: URLSearchParams,
): string | 'invalid' | null {
  if (pathname.startsWith('/travel/esim/product/')) {
    const id = esimProductOptionIdFromPath(pathname)
    if (!id) return null
    if (!isWellFormedOptionApiId(id)) return 'invalid'
    return `option=${encodeURIComponent(id)}`
  }
  if (pathname === '/travel/esim/recommend') {
    // 체크아웃 복귀는 스냅샷 복원 — 국가 판정 대상 아님
    if (searchParams.get('fromCheckout') === '1') return null
    const code = normalizeEsimDestinationCode(searchParams.get('country'))
    if (!code) return null
    return `country=${encodeURIComponent(code)}`
  }
  return null
}

async function fetchSellable(req: NextRequest, query: string): Promise<boolean | null> {
  const cached = cacheGet(query)
  if (cached !== null) return cached
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS)
  try {
    const url = `${sellableCheckOrigin()}${BONGSIM_SELLABLE_API_PATH}?${query}`
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'application/json', 'x-bongsim-sellable-check': '1' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const body = (await res.json()) as { sellable?: unknown }
    if (typeof body.sellable !== 'boolean') return null
    cacheSet(query, body.sellable)
    return body.sellable
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function notFoundRewrite(req: NextRequest): NextResponse {
  const res = NextResponse.rewrite(new URL('/_not-found', req.url), { status: 404 })
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
  res.headers.set('X-Robots-Tag', 'noindex')
  return res
}

/** 판매 불가가 확정이면 404 응답, 아니면 null(다음 middleware 단계로) */
export async function esimUnavailableNotFoundResponse(req: NextRequest): Promise<NextResponse | null> {
  const q = esimSellableQueryForRequest(req.nextUrl.pathname, req.nextUrl.searchParams)
  if (q === null) return null
  if (q === 'invalid') return notFoundRewrite(req)
  const sellable = await fetchSellable(req, q)
  return sellable === false ? notFoundRewrite(req) : null
}
