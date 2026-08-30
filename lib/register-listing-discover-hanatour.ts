/**
 * hanatour 목록 — Playwright. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: hanatour list HTML — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: listing_discover_hanatour — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: 홈 검색함 · bundled Chromium — manifest
 * REGRESSION-FREEZE[register-hanatour-listing-package-first]: 짧은 검색어 · 시드 pkgCd 제외 — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

export const HANATOUR_LISTING_PAUSE_MS_MIN = 8000
export const HANATOUR_LISTING_PAUSE_MS_MAX = 14000
export const HANATOUR_LISTING_PAGES_PER_BROWSER = 3
export const HANATOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 400_000
export const HANATOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_hanatour.main'

const HANATOUR_TRP_DETAIL = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200'
const HANATOUR_HOME = 'https://www.hanatour.com/'

export function buildHanatourDetailUrl(pkgCd: string): string {
  return `${HANATOUR_TRP_DETAIL}?pkgCd=${encodeURIComponent(pkgCd)}&prePage=major-products`
}

/** 상품 검색은 홈 검색함만. 404 옛 목록 URL 없음. */
export function buildHanatourListUrl(_searchWord: string): string {
  return HANATOUR_HOME
}

/** 마케팅 문장 대신 도시·나라 한 토막만. 어제 목록이 비던 검색어를 막는다. */
// REGRESSION-FREEZE[register-hanatour-listing-package-first]: 짧은 검색어 — manifest
export function hanatourListingSearchWord(raw: string): string {
  let s = String(raw ?? '').trim()
  s = s.replace(/\([^)]*\)/g, ' ')
  for (const sep of ['·', ',', '/', '|', ' 외']) {
    if (s.includes(sep)) s = (s.split(sep)[0] ?? s).trim()
  }
  s = s.replace(/\s+/g, ' ').trim()
  return (s.split(' ')[0] ?? '').slice(0, 12)
}

/** 시드 상세(이미 등록된 상품)는 목록 결과에 넣지 않는다. */
export function dropHanatourSeedPkgCd(pkgCds: readonly string[], seedOriginUrl: string): string[] {
  const m = /[?&]pkgCd=([A-Za-z0-9]+)/i.exec(seedOriginUrl)
  const seed = (m?.[1] ?? '').toUpperCase()
  if (!seed) return [...pkgCds]
  return pkgCds.filter((c) => c.toUpperCase() !== seed)
}

export function extractHanatourListingPkgCds(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const pkgCd = decodeURIComponent(raw).trim()
    if (!/^[A-Z]{2,4}\d{3}[A-Z0-9]{6,}$/i.test(pkgCd) && !/^[A-Z0-9]{10,}$/i.test(pkgCd)) return
    const key = pkgCd.toUpperCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(pkgCd)
  }
  const hrefRe = /[?&]pkgCd=([A-Za-z0-9]+)/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(html))) push(m[1] ?? '')
  const jsonRe = /"(?:saleProdCd|pkgCd)"\s*:\s*"([A-Za-z0-9]+)"/gi
  while ((m = jsonRe.exec(html))) push(m[1] ?? '')
  return out
}

function pauseMs(): number {
  return (
    HANATOUR_LISTING_PAUSE_MS_MIN +
    Math.floor(Math.random() * (HANATOUR_LISTING_PAUSE_MS_MAX - HANATOUR_LISTING_PAUSE_MS_MIN))
  )
}

export async function waitHanatourListingHumanPause(): Promise<void> {
  await new Promise((r) => setTimeout(r, pauseMs()))
}

export async function fetchHanatourListingDetailUrls(args: {
  seedOriginUrl: string
  searchWord: string
}): Promise<string[]> {
  const map = await fetchHanatourListingDetailUrlMap([
    { id: 'one', searchWord: args.searchWord, seedOriginUrl: args.seedOriginUrl },
  ])
  return map.get('one') ?? []
}

export async function fetchHanatourListingDetailUrlMap(
  slots: Array<{ id: string; searchWord: string; seedOriginUrl: string }>,
): Promise<Map<string, string[]>> {
  const rows = await spawnListingDiscoverPython({
    module: HANATOUR_LISTING_DISCOVER_MODULE,
    slots: slots.map((s) => ({
      ...s,
      searchWord: hanatourListingSearchWord(s.searchWord),
    })),
    timeoutMs: HANATOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS,
  })
  return new Map(rows.map((r) => [r.id, r.urls]))
}
