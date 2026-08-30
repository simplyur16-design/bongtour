/**
 * verygoodtour 목록 — Playwright ProductList. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: verygoodtour ProductList — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: listing_discover_verygoodtour — manifest
 * REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: SearchList only — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: bundled Chromium · 공급사 자체 간격 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-search-not-404]: 홈 검색함 · Search/SearchList — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

export const VERYGOODTOUR_LISTING_PAUSE_MS_MIN = 9000
export const VERYGOODTOUR_LISTING_PAUSE_MS_MAX = 15000
export const VERYGOODTOUR_LISTING_PAGES_PER_BROWSER = 2
export const VERYGOODTOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 400_000
export const VERYGOODTOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_verygoodtour.main'

export function buildVerygoodtourDetailUrl(proCode: string): string {
  return `https://www.verygoodtour.com/Product/PackageDetail?ProCode=${encodeURIComponent(proCode)}`
}

/** 마케팅 문장 대신 도시·나라 한 토막. */
// REGRESSION-FREEZE[register-listing-discover-human-search-not-404]: 짧은 검색어 — manifest
export function verygoodtourListingSearchWord(raw: string): string {
  let s = String(raw ?? '').trim()
  s = s.replace(/\([^)]*\)/g, ' ')
  for (const sep of ['·', ',', '/', '|', ' 외']) {
    if (s.includes(sep)) s = (s.split(sep)[0] ?? s).trim()
  }
  s = s.replace(/\s+/g, ' ').trim()
  return (s.split(' ')[0] ?? '').slice(0, 12)
}

/** 상품 검색은 홈 검색함만. 옛 목록 404 주소 없음. */
export function buildVerygoodtourListUrl(_searchWord: string): string {
  return 'https://www.verygoodtour.com/'
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
    slots: slots.map((s) => ({
      ...s,
      searchWord: verygoodtourListingSearchWord(s.searchWord),
    })),
    timeoutMs: VERYGOODTOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS,
  })
  return new Map(rows.map((r) => [r.id, r.urls]))
}
