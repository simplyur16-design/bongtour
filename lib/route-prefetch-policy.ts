/**
 * Next.js Link viewport/touch prefetch — 무거운 browse·상세 RSC 폭주 방지.
 * Header `HEAVY_NAV_PREFETCH_OFF` 와 동일 기준을 단일 SSOT로 둔다.
 */
const HEAVY_ROUTE_PREFIXES = [
  '/travel/overseas',
  '/travel/air-hotel',
  '/travel/esim',
  '/travel/overseas/private-trip',
  '/business',
  '/inquiry',
  '/products/',
] as const

function pathnameFromHref(href: string): string {
  const raw = href.trim()
  if (!raw || raw.startsWith('#')) return ''
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).pathname
    } catch {
      return ''
    }
  }
  return raw.split('?')[0].split('#')[0] || ''
}

/** `Link prefetch` — false면 Next가 viewport/touch prefetch를 하지 않음 */
export function shouldPrefetchNextLink(href: string): boolean {
  const path = pathnameFromHref(href)
  if (!path) return true
  for (const prefix of HEAVY_ROUTE_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return false
  }
  return true
}

export function prefetchPropForHref(href: string): boolean | undefined {
  return shouldPrefetchNextLink(href) ? undefined : false
}
