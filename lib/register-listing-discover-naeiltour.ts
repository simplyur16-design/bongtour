/**
 * naeiltour 목록 — Playwright. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: listing_discover_naeiltour — manifest
 * REGRESSION-FREEZE[register-listing-discover-overseas-click]: 홈→해외여행→메가메뉴 지명 클릭 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: bundled Chromium · 공급사 자체 간격 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-naeiltour-fit-first]: listingMenu FIT — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

export const NAEILTOUR_LISTING_PAUSE_MS_MIN = 14000
export const NAEILTOUR_LISTING_PAUSE_MS_MAX = 20000
export const NAEILTOUR_LISTING_PAGES_PER_BROWSER = 2
export const NAEILTOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 410_000
export const NAEILTOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_naeiltour.main'

const NAEILTOUR_DETAIL = 'https://www.naeiltour.co.kr/sub/view.asp'
const NAEILTOUR_HOME = 'https://www.naeiltour.co.kr/'

export function buildNaeiltourDetailUrl(goodCd: string): string {
  return `${NAEILTOUR_DETAIL}?good_cd=${encodeURIComponent(goodCd)}`
}

export function buildNaeiltourListUrl(_searchWord: string): string {
  return NAEILTOUR_HOME
}

export function extractNaeiltourListingGoodCds(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const code = decodeURIComponent(raw).trim()
    if (!/^[A-Za-z0-9]{6,}$/.test(code)) return
    const key = code.toUpperCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(code)
  }
  const hrefRe = /[?&]good_cd=([A-Za-z0-9]+)/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(html))) push(m[1] ?? '')
  return out
}

function pauseMs(): number {
  return (
    NAEILTOUR_LISTING_PAUSE_MS_MIN +
    Math.floor(Math.random() * (NAEILTOUR_LISTING_PAUSE_MS_MAX - NAEILTOUR_LISTING_PAUSE_MS_MIN))
  )
}

export async function waitNaeiltourListingHumanPause(): Promise<void> {
  await new Promise((r) => setTimeout(r, pauseMs()))
}

export async function fetchNaeiltourListingDetailUrlMap(
  slots: Array<{
    id: string
    searchWord: string
    seedOriginUrl: string
    listingMenu?: 'PKG' | 'FIT'
  }>,
): Promise<Map<string, string[]>> {
  const rows = await spawnListingDiscoverPython({
    module: NAEILTOUR_LISTING_DISCOVER_MODULE,
    slots,
    timeoutMs: NAEILTOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS,
  })
  return new Map(rows.map((r) => [r.id, r.urls]))
}
