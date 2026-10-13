/**
 * modetour 목록 — B2C API(SearchThemeAndLocalKey→SearchProductMaster) + human pace.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: modetour search HTML — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: listing_discover_modetour — manifest
 * REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: search list only — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: bundled Chromium · 공급사 자체 간격 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-search-not-404]: 홈 검색함 · /search 404 금지 — manifest
 * REGRESSION-FREEZE[register-listing-discover-modetour-b2c-search]: computedProductCode → /package/{code} — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

/** 사람 리듬 — 슬롯·세션 간격. 공통 스크래퍼 SSOT 아님. */
export const MODETOUR_LISTING_PAUSE_MS_MIN = 18000
export const MODETOUR_LISTING_PAUSE_MS_MAX = 28000
/** 세션당 1슬롯 — B2C 연타·confirm 연타 완화 */
export const MODETOUR_LISTING_PAGES_PER_BROWSER = 1
export const MODETOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 400_000
export const MODETOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_modetour.main'

export function buildModetourDetailUrl(productNo: string): string {
  return `https://www.modetour.com/package/${encodeURIComponent(productNo)}`
}

const MODETOUR_HOME_SEARCH_WORDS = new Set([
  '부산출발',
  '대구출발',
  '청주출발',
  '골프',
  '러닝',
  '트레킹',
  '다이빙',
])

/** 마케팅 문장 대신 도시·나라 한 토막. 지방출발·테마 키워드는 그대로. */
// REGRESSION-FREEZE[register-listing-discover-human-search-not-404]: 짧은 검색어 — manifest
export function modetourListingSearchWord(raw: string): string {
  let s = String(raw ?? '').trim()
  if (MODETOUR_HOME_SEARCH_WORDS.has(s)) return s
  s = s.replace(/\([^)]*\)/g, ' ')
  for (const sep of ['·', ',', '/', '|', ' 외']) {
    if (s.includes(sep)) s = (s.split(sep)[0] ?? s).trim()
  }
  s = s.replace(/\s+/g, ' ').trim()
  return (s.split(' ')[0] ?? '').slice(0, 12)
}

/** 홈 검색함 진입점. 결과 SPA는 /package/overseas?keyword= … (/search 는 404). */
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
