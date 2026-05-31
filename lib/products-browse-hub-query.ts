import { parseBrowseQuery } from '@/lib/products-browse-query'

export const OVERSEAS_HUB_BROWSE_LIMIT = '120'
export const AIR_HOTEL_HUB_BROWSE_LIMIT = '120'
export const DOMESTIC_HUB_BROWSE_LIMIT = '30'

export function searchParamsRecordToUrlSearchParams(
  sp: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const p = new URLSearchParams()
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === 'string') p.set(key, val)
    else if (Array.isArray(val) && typeof val[0] === 'string') p.set(key, val[0])
  }
  return p
}

function applyBudgetFitSortIfNeeded(p: URLSearchParams): void {
  const q = parseBrowseQuery(new URLSearchParams(p.toString()))
  if ((q.budgetPerPerson != null || q.budgetMin != null) && !p.get('sort')) {
    p.set('sort', 'budget_fit')
  }
}

/** `URLSearchParams.toString()` 삽입 순서 차이로 SSR/CSR prefetch 키가 어긋나는 것 방지 */
export function canonicalBrowseQueryKey(p: URLSearchParams): string {
  const sorted = new URLSearchParams()
  for (const key of [...new Set([...p.keys()])].sort()) {
    const v = p.get(key)
    if (v != null) sorted.set(key, v)
  }
  return sorted.toString()
}

/** 해외 허브 — `ProductsBrowseClient` fetch URL 키 SSOT */
export function buildOverseasHubBrowseQueryKey(qsInput: URLSearchParams | string): string {
  const p =
    typeof qsInput === 'string' ? new URLSearchParams(qsInput) : new URLSearchParams(qsInput.toString())
  if (!p.get('scope')) p.set('scope', 'overseas')
  p.delete('listingKind')
  p.set('limit', OVERSEAS_HUB_BROWSE_LIMIT)
  p.delete('page')
  applyBudgetFitSortIfNeeded(p)
  return canonicalBrowseQueryKey(p)
}

/** `/products` 일반 목록 — 허브 전용 limit/scope 규칙 없음 */
export function buildProductsBrowseQueryKey(
  qsInput: URLSearchParams | string,
  defaultScope?: 'overseas' | 'domestic',
): string {
  const p =
    typeof qsInput === 'string' ? new URLSearchParams(qsInput) : new URLSearchParams(qsInput.toString())
  if (defaultScope && !p.get('scope')) p.set('scope', defaultScope)
  applyBudgetFitSortIfNeeded(p)
  return canonicalBrowseQueryKey(p)
}

/** 항공+호텔 — country/region/city는 클라이언트 필터, API 키에서는 제외 */
export function buildAirHotelHubBrowseQueryKey(qsInput: URLSearchParams | string): string {
  const p =
    typeof qsInput === 'string' ? new URLSearchParams(qsInput) : new URLSearchParams(qsInput.toString())
  if (!p.get('scope')) p.set('scope', 'overseas')
  p.set('limit', AIR_HOTEL_HUB_BROWSE_LIMIT)
  p.delete('page')
  p.delete('country')
  p.delete('region')
  p.delete('city')
  applyBudgetFitSortIfNeeded(p)
  return canonicalBrowseQueryKey(p)
}

const DOMESTIC_HUB_SORT_VALUES = new Set(['budget_fit', 'price_asc', 'price_desc', 'departure_asc'])

/** 국내 허브 — 레거시 쿼리 키 제거, sort만 유지 */
export function buildDomesticHubBrowseQueryKey(qsInput: URLSearchParams | string): string {
  const src = typeof qsInput === 'string' ? new URLSearchParams(qsInput) : new URLSearchParams(qsInput.toString())
  const p = new URLSearchParams()
  p.set('scope', 'domestic')
  p.set('limit', DOMESTIC_HUB_BROWSE_LIMIT)
  const sortRaw = src.get('sort')
  if (sortRaw && DOMESTIC_HUB_SORT_VALUES.has(sortRaw)) p.set('sort', sortRaw)
  return canonicalBrowseQueryKey(p)
}
