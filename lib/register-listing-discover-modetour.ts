/**
 * modetour 목록 — Playwright. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: modetour search HTML — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: listing_discover_modetour — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

export const MODETOUR_LISTING_PAUSE_MS_MIN = 2000
export const MODETOUR_LISTING_PAUSE_MS_MAX = 3600
export const MODETOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 240_000
export const MODETOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_modetour.main'

export function buildModetourDetailUrl(productNo: string): string {
  return `https://www.modetour.com/package/${encodeURIComponent(productNo)}`
}

export function buildModetourSearchUrl(searchWord: string): string {
  return `https://www.modetour.com/search?keyword=${encodeURIComponent(searchWord.trim())}`
}

export function extractModetourListingProductNos(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const productNo = String(raw).trim()
    if (!/^\d{6,12}$/.test(productNo) || productNo === '0') return
    if (seen.has(productNo)) return
    seen.add(productNo)
    out.push(productNo)
  }
  const hrefRe = /\/package\/(\d{6,12})(?:[/?#"'\s]|$)/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(html))) push(m[1] ?? '')
  const jsonRe = /"(?:productNo|ProductNo)"\s*:\s*"?(\d{6,12})"?/g
  while ((m = jsonRe.exec(html))) push(m[1] ?? '')
  return out
}

function pauseMs(): number {
  return (
    MODETOUR_LISTING_PAUSE_MS_MIN +
    Math.floor(Math.random() * (MODETOUR_LISTING_PAUSE_MS_MAX - MODETOUR_LISTING_PAUSE_MS_MIN))
  )
}

export async function waitModetourListingHumanPause(): Promise<void> {
  await new Promise((r) => setTimeout(r, pauseMs()))
}

export async function fetchModetourListingDetailUrls(args: {
  seedOriginUrl: string
  searchWord: string
}): Promise<string[]> {
  const map = await fetchModetourListingDetailUrlMap([
    { id: 'one', searchWord: args.searchWord, seedOriginUrl: args.seedOriginUrl },
  ])
  return map.get('one') ?? []
}

export async function fetchModetourListingDetailUrlMap(
  slots: Array<{ id: string; searchWord: string; seedOriginUrl: string }>,
): Promise<Map<string, string[]>> {
  const rows = await spawnListingDiscoverPython({
    module: MODETOUR_LISTING_DISCOVER_MODULE,
    slots,
    timeoutMs: MODETOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS,
  })
  return new Map(rows.map((r) => [r.id, r.urls]))
}
