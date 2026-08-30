/**
 * ybtour 목록 — Playwright localList. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: ybtour localList — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: listing_discover_ybtour — manifest
 * REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: localList only — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: parent localList first · bundled Chromium — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

export const YBTOUR_LISTING_PAUSE_MS_MIN = 7000
export const YBTOUR_LISTING_PAUSE_MS_MAX = 12000
export const YBTOUR_LISTING_PAGES_PER_BROWSER = 4
export const YBTOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 400_000
export const YBTOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_ybtour.main'

export function parseYbtourDspSidFromUrl(url: string | null | undefined): string | null {
  const m = String(url ?? '').match(/[?&]dspSid=([^&]+)/i)
  const v = m?.[1]?.trim()
  return v || null
}

export function ybtourListingMenuFromUrl(url: string | null | undefined): 'PKG' | 'FIT' {
  const m = String(url ?? '').match(/[?&]menu=([^&]+)/i)
  const v = (m?.[1] ?? '').trim().toUpperCase()
  return v === 'FIT' ? 'FIT' : 'PKG'
}

export function buildYbtourLocalListUrl(dspSid: string, menu: 'PKG' | 'FIT'): string {
  return `https://prdt.ybtour.co.kr/product/localList?menu=${menu}&dspSid=${encodeURIComponent(dspSid)}`
}

export function buildYbtourDetailUrl(evCd: string, dspSid: string, menu: 'PKG' | 'FIT'): string {
  return `https://prdt.ybtour.co.kr/product/detailPackage?menu=${menu}&dspSid=${encodeURIComponent(dspSid)}&evCd=${encodeURIComponent(evCd)}`
}

/** localList HTML·임베드 JSON에서 evCd 수집 */
export function extractYbtourListingEvCds(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const evCd = decodeURIComponent(raw).trim()
    if (!/^[A-Z0-9]+-\d{6}/i.test(evCd)) return
    const key = evCd.toUpperCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(evCd)
  }
  const hrefRe = /[?&]evCd=([A-Za-z0-9-]+)/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(html))) push(m[1] ?? '')
  const jsonRe = /"evCd"\s*:\s*"([A-Za-z0-9-]+)"/gi
  while ((m = jsonRe.exec(html))) push(m[1] ?? '')
  return out
}

function pauseMs(): number {
  return YBTOUR_LISTING_PAUSE_MS_MIN + Math.floor(Math.random() * (YBTOUR_LISTING_PAUSE_MS_MAX - YBTOUR_LISTING_PAUSE_MS_MIN))
}

export async function waitYbtourListingHumanPause(): Promise<void> {
  await new Promise((r) => setTimeout(r, pauseMs()))
}

export async function fetchYbtourListingDetailUrls(args: {
  seedOriginUrl: string
  listingMenu?: 'PKG' | 'FIT'
}): Promise<string[]> {
  const map = await fetchYbtourListingDetailUrlMap([
    {
      id: 'one',
      searchWord: '',
      seedOriginUrl: args.seedOriginUrl,
      listingMenu: args.listingMenu ?? ybtourListingMenuFromUrl(args.seedOriginUrl),
    },
  ])
  return map.get('one') ?? []
}

export async function fetchYbtourListingDetailUrlMap(
  slots: Array<{
    id: string
    searchWord: string
    seedOriginUrl: string
    listingMenu?: 'PKG' | 'FIT'
  }>,
): Promise<Map<string, string[]>> {
  const rows = await spawnListingDiscoverPython({
    module: YBTOUR_LISTING_DISCOVER_MODULE,
    slots,
    timeoutMs: YBTOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS,
  })
  return new Map(rows.map((r) => [r.id, r.urls]))
}
