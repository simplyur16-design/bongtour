/**
 * verygoodtour 목록 — Playwright ProductList. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: verygoodtour ProductList — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: listing_discover_verygoodtour — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

export const VERYGOODTOUR_LISTING_PAUSE_MS_MIN = 2500
export const VERYGOODTOUR_LISTING_PAUSE_MS_MAX = 4300
export const VERYGOODTOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 260_000
export const VERYGOODTOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_verygoodtour.main'

export function buildVerygoodtourDetailUrl(proCode: string): string {
  return `https://www.verygoodtour.com/Product/PackageDetail?ProCode=${encodeURIComponent(proCode)}`
}

export function buildVerygoodtourListUrl(searchWord: string): string {
  return `https://www.verygoodtour.com/Product/ProductList?SearchWord=${encodeURIComponent(searchWord.trim())}`
}

export function extractVerygoodtourListingProCodes(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const proCode = decodeURIComponent(raw).trim()
    if (!/^[A-Z]{2,4}\d{3,5}-[A-Z0-9]+$/i.test(proCode) && !/^[A-Z]{2,4}\d{4,}/i.test(proCode)) return
    const key = proCode.toUpperCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(proCode)
  }
  const hrefRe = /[?&]ProCode=([A-Za-z0-9-]+)/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(html))) push(m[1] ?? '')
  const jsonRe = /"(?:ProCode|proCode)"\s*:\s*"([A-Za-z0-9-]+)"/gi
  while ((m = jsonRe.exec(html))) push(m[1] ?? '')
  return out
}

function pauseMs(): number {
  return (
    VERYGOODTOUR_LISTING_PAUSE_MS_MIN +
    Math.floor(Math.random() * (VERYGOODTOUR_LISTING_PAUSE_MS_MAX - VERYGOODTOUR_LISTING_PAUSE_MS_MIN))
  )
}

export async function waitVerygoodtourListingHumanPause(): Promise<void> {
  await new Promise((r) => setTimeout(r, pauseMs()))
}

export async function fetchVerygoodtourListingDetailUrls(args: {
  seedOriginUrl: string
  searchWord: string
}): Promise<string[]> {
  const map = await fetchVerygoodtourListingDetailUrlMap([
    { id: 'one', searchWord: args.searchWord, seedOriginUrl: args.seedOriginUrl },
  ])
  return map.get('one') ?? []
}

export async function fetchVerygoodtourListingDetailUrlMap(
  slots: Array<{ id: string; searchWord: string; seedOriginUrl: string }>,
): Promise<Map<string, string[]>> {
  const rows = await spawnListingDiscoverPython({
    module: VERYGOODTOUR_LISTING_DISCOVER_MODULE,
    slots,
    timeoutMs: VERYGOODTOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS,
  })
  return new Map(rows.map((r) => [r.id, r.urls]))
}
