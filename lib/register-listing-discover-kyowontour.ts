/**
 * kyowontour 목록 — Playwright. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: listing_discover_kyowontour — manifest
 * REGRESSION-FREEZE[register-listing-discover-overseas-click]: 홈→해외여행→메가메뉴 지명 클릭 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: bundled Chromium · 공급사 자체 간격 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-popup-dismiss]: 홈 팝업 닫고 해외여행 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-mega-menu]: 사이트 메뉴 글자만 클릭 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-calendar-product]: 나라→출발일→달력 아래 상품 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-detail-schedule]: 달력 아래 목록의 상세일정 클릭 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-list-depart-calendar]: 나라 목록 상품 출발일→달력→상세일정 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-expanded-card-click]: 열린 카드 달력·상세만 — manifest
 */
import { spawnListingDiscoverPython } from '@/lib/register-listing-discover-spawn'

export const KYOWONTOUR_LISTING_PAUSE_MS_MIN = 10000
export const KYOWONTOUR_LISTING_PAUSE_MS_MAX = 16000
export const KYOWONTOUR_LISTING_PAGES_PER_BROWSER = 2
export const KYOWONTOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS = 420_000
export const KYOWONTOUR_LISTING_DISCOVER_MODULE = 'scripts.listing_discover_kyowontour.main'

const KYOWONTOUR_DETAIL = 'https://www.kyowontour.com/goods/goodsEventDetail'
const KYOWONTOUR_HOME = 'https://www.kyowontour.com/'

export function buildKyowontourDetailUrl(tourCode: string): string {
  return `${KYOWONTOUR_DETAIL}?tourCode=${encodeURIComponent(tourCode)}`
}

export function buildKyowontourListUrl(_searchWord: string): string {
  return KYOWONTOUR_HOME
}

export function extractKyowontourListingTourCodes(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const code = decodeURIComponent(raw).trim()
    if (!/^[A-Za-z0-9]{8,}$/.test(code)) return
    const key = code.toUpperCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(code)
  }
  const hrefRe = /[?&]tourCode=([A-Za-z0-9]+)/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(html))) push(m[1] ?? '')
  const jsonRe = /"(?:tourCode|TourCode)"\s*:\s*"([A-Za-z0-9]+)"/gi
  while ((m = jsonRe.exec(html))) push(m[1] ?? '')
  return out
}

function pauseMs(): number {
  return (
    KYOWONTOUR_LISTING_PAUSE_MS_MIN +
    Math.floor(Math.random() * (KYOWONTOUR_LISTING_PAUSE_MS_MAX - KYOWONTOUR_LISTING_PAUSE_MS_MIN))
  )
}

export async function waitKyowontourListingHumanPause(): Promise<void> {
  await new Promise((r) => setTimeout(r, pauseMs()))
}

export async function fetchKyowontourListingDetailUrlMap(
  slots: Array<{ id: string; searchWord: string; seedOriginUrl: string }>,
): Promise<Map<string, string[]>> {
  const rows = await spawnListingDiscoverPython({
    module: KYOWONTOUR_LISTING_DISCOVER_MODULE,
    slots,
    timeoutMs: KYOWONTOUR_LISTING_PLAYWRIGHT_TIMEOUT_MS,
  })
  return new Map(rows.map((r) => [r.id, r.urls]))
}
