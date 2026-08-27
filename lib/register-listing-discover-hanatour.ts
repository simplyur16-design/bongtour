/**
 * hanatour 목록 — Playwright. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: hanatour list HTML — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: listing_discover_hanatour — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

export const HANATOUR_LISTING_PAUSE_MS_MIN = 2200
export const HANATOUR_LISTING_PAUSE_MS_MAX = 4100
export const HANATOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 240_000
export const HANATOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_hanatour.main'

const HANATOUR_TRP_DETAIL = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200'
const HANATOUR_TRP_LIST = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0119P200'

export function buildHanatourDetailUrl(pkgCd: string): string {
  return `${HANATOUR_TRP_DETAIL}?pkgCd=${encodeURIComponent(pkgCd)}&prePage=major-products`
}

export function buildHanatourListUrl(searchWord: string): string {
  const q = searchWord.trim()
  if (!q) return HANATOUR_TRP_LIST
  return `${HANATOUR_TRP_LIST}?searchWord=${encodeURIComponent(q)}`
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
    slots,
    timeoutMs: HANATOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS,
  })
  return new Map(rows.map((r) => [r.id, r.urls]))
}
