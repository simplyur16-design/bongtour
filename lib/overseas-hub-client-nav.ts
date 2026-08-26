/** 해외 허브 — query-only 전환. Next.js soft-nav(RSC) 없이 URL·구독자만 갱신 */

export const OVERSEAS_HUB_PATH = '/travel/overseas'

type Listener = () => void
const listeners = new Set<Listener>()

let popstateBound = false
/** pushState 직후 location.search 파싱 타이밍 보정 */
let pendingSearchParamsString: string | null = null

function bindPopstateOnce(): void {
  if (popstateBound || typeof window === 'undefined') return
  popstateBound = true
  window.addEventListener('popstate', () => {
    pendingSearchParamsString = null
    notifyOverseasHubUrl()
  })
}

export function subscribeOverseasHubUrl(listener: Listener): () => void {
  bindPopstateOnce()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyOverseasHubUrl(): void {
  for (const listener of listeners) listener()
}

/** `?` 제외 search string */
export function getOverseasHubSearchParamsString(): string {
  if (pendingSearchParamsString != null) return pendingSearchParamsString
  if (typeof window === 'undefined') return ''
  const raw = window.location.search
  return raw.startsWith('?') ? raw.slice(1) : raw
}

function parseHubHref(href: string): URL | null {
  try {
    return new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://bongtour.local')
  } catch {
    return null
  }
}

export function isOverseasHubRegionOnlyHref(href: string): boolean {
  const url = parseHubHref(href)
  if (!url || url.pathname !== OVERSEAS_HUB_PATH) return false
  const region = (url.searchParams.get('region') ?? '').trim()
  if (!region) return false
  if ((url.searchParams.get('country') ?? '').trim()) return false
  if ((url.searchParams.get('city') ?? '').trim()) return false
  if ((url.searchParams.get('destination') ?? '').trim()) return false
  return true
}

export function isOnOverseasHubPage(): boolean {
  return typeof window !== 'undefined' && window.location.pathname === OVERSEAS_HUB_PATH
}

export function shouldUseOverseasHubClientNav(href: string): boolean {
  if (!isOnOverseasHubPage()) return false
  return isOverseasHubRegionOnlyHref(href)
}

function hubUrlFromSearchParams(params: URLSearchParams): string {
  const qs = params.toString()
  return qs ? `${OVERSEAS_HUB_PATH}?${qs}` : OVERSEAS_HUB_PATH
}

export function replaceOverseasHubUrl(params: URLSearchParams): void {
  if (typeof window === 'undefined') return
  const qs = params.toString()
  const next = hubUrlFromSearchParams(params)
  const current = `${window.location.pathname}${window.location.search}`
  if (current === next && pendingSearchParamsString === qs) return
  pendingSearchParamsString = qs
  window.history.replaceState(null, '', next)
  notifyOverseasHubUrl()
}

/** 허브에 있을 때 메가메뉴 대분류 탭 — Link/RSC 없음 */
export function navigateOverseasHubRegionClient(href: string): boolean {
  if (!shouldUseOverseasHubClientNav(href)) return false
  const url = parseHubHref(href)
  if (!url) return false
  if (typeof window !== 'undefined') {
    const currentType = (new URLSearchParams(window.location.search).get('type') ?? '').trim()
    if (currentType && !(url.searchParams.get('type') ?? '').trim()) {
      url.searchParams.set('type', currentType)
    }
  }
  const qs = url.searchParams.toString()
  const next = `${url.pathname}${url.search}`
  const current = `${window.location.pathname}${window.location.search}`
  pendingSearchParamsString = qs
  if (current !== next) {
    window.history.pushState(null, '', next)
  }
  notifyOverseasHubUrl()
  return true
}
