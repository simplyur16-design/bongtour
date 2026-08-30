/**
 * lottetour 목록 — Playwright. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: listing_discover_lottetour — manifest
 * REGRESSION-FREEZE[register-listing-discover-overseas-click]: 홈→해외여행→메가메뉴 지명 클릭 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: bundled Chromium · 공급사 자체 간격 — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

export const LOTTETOUR_LISTING_PAUSE_MS_MIN = 13000
export const LOTTETOUR_LISTING_PAUSE_MS_MAX = 19000
export const LOTTETOUR_LISTING_PAGES_PER_BROWSER = 2
export const LOTTETOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 430_000
export const LOTTETOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_lottetour.main'

const LOTTETOUR_HOME = 'https://www.lottetour.com/'

export function buildLottetourListUrl(_searchWord: string): string {
  return LOTTETOUR_HOME
}

/** 페이지에 실제로 있는 evtDetail·evtList 주소만. 경로를 지어내지 않는다. */
export function extractLottetourListingDetailUrls(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const hrefRe = /https?:\/\/(?:www\.)?lottetour\.com\/(?:evtDetail|evtList)\/[^\s"'<>#]+/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(html))) {
    const url = (m[0] ?? '').split('#')[0]?.replace(/&amp;/g, '&') ?? ''
    if (!url) continue
    if (!/evtCd=|godId=|\/evtDetail\//i.test(url)) continue
    const key = url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(url)
  }
  return out
}

function pauseMs(): number {
  return (
    LOTTETOUR_LISTING_PAUSE_MS_MIN +
    Math.floor(Math.random() * (LOTTETOUR_LISTING_PAUSE_MS_MAX - LOTTETOUR_LISTING_PAUSE_MS_MIN))
  )
}

export async function waitLottetourListingHumanPause(): Promise<void> {
  await new Promise((r) => setTimeout(r, pauseMs()))
}

export async function fetchLottetourListingDetailUrlMap(
  slots: Array<{ id: string; searchWord: string; seedOriginUrl: string }>,
): Promise<Map<string, string[]>> {
  const rows = await spawnListingDiscoverPython({
    module: LOTTETOUR_LISTING_DISCOVER_MODULE,
    slots,
    timeoutMs: LOTTETOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS,
  })
  return new Map(rows.map((r) => [r.id, r.urls]))
}
