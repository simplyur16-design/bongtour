/**
 * 공개 상품 상세 URL(`/products/<slug|cuid>`)의 실제 HTTP 상태 판정 — middleware(Edge)에서 사용.
 *
 * 상세 페이지는 `loading.tsx`·Suspense 스트리밍이라 페이지 안의 `permanentRedirect`·`notFound`가
 * HTTP 200 + meta refresh/soft 404 로 나간다. 검색엔진에는 진짜 308/404 가 필요하므로
 * middleware 가 응답 시작 전에 공개 조회 결과를 받아 308(→ slug) / 404 를 직접 돌려준다.
 *
 * Edge 안전 모듈 — prisma import 금지. DB 조회는 `/api/public/product-path-status`(Node) 담당.
 */

export type ProductPathStatus =
  | { kind: 'render' }
  | { kind: 'redirect'; slug: string }
  /** REGRESSION-FREEZE[seo-training-products-301]: 다른 정식 경로(국외연수 `/business/programs/*`)로 301 */
  | { kind: 'redirect_path'; path: string }
  | { kind: 'not_found' }
  /** REGRESSION-FREEZE[seo-deleted-product-410]: DB 에 행이 아예 없는(영구 삭제) 상품 주소 → 410. 비공개·출발 종료 행은 not_found(404) */
  | { kind: 'gone' }

export const PRODUCT_PATH_STATUS_API_PATH = '/api/public/product-path-status'

/** `/products/<segment>` (단일 세그먼트, 끝 슬래시 허용) → segment. 아니면 null */
export function parseProductDetailPathSegment(pathname: string): string | null {
  const m = /^\/products\/([^/]+)\/?$/.exec(pathname)
  if (!m) return null
  let seg = m[1]!
  try {
    seg = decodeURIComponent(seg)
  } catch {
    return null
  }
  seg = seg.trim()
  return seg ? seg : null
}

export function parseProductPathStatus(body: unknown): ProductPathStatus | null {
  if (!body || typeof body !== 'object') return null
  const o = body as { kind?: unknown; slug?: unknown }
  if (o.kind === 'render') return { kind: 'render' }
  if (o.kind === 'not_found') return { kind: 'not_found' }
  if (o.kind === 'gone') return { kind: 'gone' }
  if (o.kind === 'redirect' && typeof o.slug === 'string' && o.slug.trim()) {
    return { kind: 'redirect', slug: o.slug.trim() }
  }
  const path = (body as { path?: unknown }).path
  if (o.kind === 'redirect_path' && typeof path === 'string' && isSafeInternalRedirectPath(path)) {
    return { kind: 'redirect_path', path }
  }
  return null
}

/** 같은 사이트 내부 절대경로만 (open redirect 방지) */
export function isSafeInternalRedirectPath(path: string): boolean {
  return /^\/(?!\/)[^\s\\]*$/.test(path) && !path.includes('://')
}

/** 410 응답 본문 — 홈 리다이렉트 대신 목록으로 안내하고 색인에서 빼도록 noindex */
export function buildGoneProductHtml(): string {
  return [
    '<!doctype html>',
    '<html lang="ko"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    '<title>판매가 종료된 상품입니다 | Bong투어</title></head>',
    '<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.6">',
    '<h1 style="font-size:1.25rem">판매가 종료된 상품입니다</h1>',
    '<p>요청하신 상품은 더 이상 판매하지 않습니다.</p>',
    '<p><a href="/products">여행 상품 목록 보기</a></p>',
    '</body></html>',
  ].join('')
}

export const GONE_PRODUCT_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'x-robots-tag': 'noindex, nofollow',
  'cache-control': 'public, max-age=0, s-maxage=300',
} as const

/** 같은 프로세스의 Node 서버(`next start -p $PORT`)에 조회 — 실패·시간초과는 null(기존 동작 유지) */
export async function fetchProductPathStatus(
  segment: string,
  opts?: { origin?: string; timeoutMs?: number; fetchImpl?: typeof fetch },
): Promise<ProductPathStatus | null> {
  const origin = opts?.origin ?? `http://127.0.0.1:${process.env.PORT || '3000'}`
  const url = `${origin}${PRODUCT_PATH_STATUS_API_PATH}?seg=${encodeURIComponent(segment)}`
  const f = opts?.fetchImpl ?? fetch
  try {
    const res = await f(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 2500),
    })
    if (!res.ok) return null
    return parseProductPathStatus(await res.json())
  } catch {
    return null
  }
}

/** 308 Location — 프록시 뒤(https) 원래 호스트 유지, 쿼리 보존 */
export function buildProductSlugRedirectLocation(
  slug: string,
  search: string,
  headers: { get(name: string): string | null },
): string {
  return buildSameHostRedirectLocation(`/products/${encodeURIComponent(slug)}`, search, headers)
}

/** 내부 경로 → 같은 호스트 절대 Location (쿼리 보존) */
export function buildSameHostRedirectLocation(
  pathname: string,
  search: string,
  headers: { get(name: string): string | null },
): string {
  const path = `${pathname}${search || ''}`
  const host = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').split(',')[0]?.trim()
  const proto = (headers.get('x-forwarded-proto') ?? '').split(',')[0]?.trim()
  if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    const scheme = proto === 'http' || proto === 'https' ? proto : host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
    return `${scheme}://${host}${path}`
  }
  return path
}
