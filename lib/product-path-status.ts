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
  | { kind: 'not_found' }

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
  if (o.kind === 'redirect' && typeof o.slug === 'string' && o.slug.trim()) {
    return { kind: 'redirect', slug: o.slug.trim() }
  }
  return null
}

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
  const path = `/products/${encodeURIComponent(slug)}${search || ''}`
  const host = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').split(',')[0]?.trim()
  const proto = (headers.get('x-forwarded-proto') ?? '').split(',')[0]?.trim()
  if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    const scheme = proto === 'http' || proto === 'https' ? proto : host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
    return `${scheme}://${host}${path}`
  }
  return path
}
