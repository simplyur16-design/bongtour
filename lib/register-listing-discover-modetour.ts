/**
 * modetour 목록 — Playwright. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: modetour search HTML — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: listing_discover_modetour — manifest
 * REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: search list only — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: bundled Chromium · 공급사 자체 간격 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-search-not-404]: 홈 검색함 · /search 404 금지 — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

export const MODETOUR_LISTING_PAUSE_MS_MIN = 11000
export const MODETOUR_LISTING_PAUSE_MS_MAX = 17000
export const MODETOUR_LISTING_PAGES_PER_BROWSER = 2
export const MODETOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 400_000
export const MODETOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_modetour.main'

export function buildModetourDetailUrl(productNo: string): string {
  return `https://www.modetour.com/package/${encodeURIComponent(productNo)}`
}

/** 마케팅 문장 대신 도시·나라 한 토막. */
// REGRESSION-FREEZE[register-listing-discover-human-search-not-404]: 짧은 검색어 — manifest
export function modetourListingSearchWord(raw: string): string {
  let s = String(raw ?? '').trim()
  s = s.replace(/\([^)]*\)/g, ' ')
  for (const sep of ['·', ',', '/', '|', ' 외']) {
    if (s.includes(sep)) s = (s.split(sep)[0] ?? s).trim()
  }
  s = s.replace(/\s+/g, ' ').trim()
  return (s.split(' ')[0] ?? '').slice(0, 12)
}

/** 상품 검색은 홈 검색함만. /search?keyword= 404 주소 없음. */
export function buildModetourSearchUrl(_searchWord: string): string {
  return 'https://www.modetour.com/'
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
    slots: slots.map((s) => ({
      ...s,
      searchWord: modetourListingSearchWord(s.searchWord),
    })),
    timeoutMs: MODETOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS,
  })
  return new Map(rows.map((r) => [r.id, r.urls]))
}
