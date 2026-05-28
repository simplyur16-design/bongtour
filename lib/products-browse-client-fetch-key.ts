import type { BrowseQueryState } from '@/lib/products-browse-query'
import {
  buildAirHotelHubBrowseQueryKey,
  buildOverseasHubBrowseQueryKey,
  canonicalBrowseQueryKey,
} from '@/lib/products-browse-hub-query'

const BROWSE_DOMESTIC_HUB_FETCH_LIMIT = '30'
const BROWSE_OVERSEAS_HUB_FETCH_LIMIT = '120'
const AIR_HOTEL_BROWSE_FETCH_LIMIT = '120'

export type BuildProductsBrowseClientFetchKeyOpts = {
  pathname: string
  defaultScope?: 'overseas' | 'domestic'
  searchParams: URLSearchParams
  qs: string
  isDomesticHub: boolean
  isAirHotelHub: boolean
  q: BrowseQueryState
}

/** `ProductsBrowseClient` fetch URL 키 — SSR prefetch·CSR fetch SSOT */
export function buildProductsBrowseClientFetchKey(opts: BuildProductsBrowseClientFetchKeyOpts): string {
  const { pathname, defaultScope, searchParams, qs, isDomesticHub, isAirHotelHub, q } = opts

  if (isDomesticHub) {
    const p = new URLSearchParams()
    p.set('scope', 'domestic')
    p.set('limit', BROWSE_DOMESTIC_HUB_FETCH_LIMIT)
    const sortRaw = searchParams.get('sort')
    if (
      sortRaw === 'budget_fit' ||
      sortRaw === 'price_asc' ||
      sortRaw === 'price_desc' ||
      sortRaw === 'departure_asc'
    ) {
      p.set('sort', sortRaw)
    }
    return canonicalBrowseQueryKey(p)
  }

  const p = new URLSearchParams(qs)
  if (defaultScope && !p.get('scope')) p.set('scope', defaultScope)

  if (defaultScope === 'overseas' && pathname === '/travel/overseas') {
    return buildOverseasHubBrowseQueryKey(p)
  }

  if (pathname === '/travel/air-hotel') {
    return buildAirHotelHubBrowseQueryKey(p)
  }

  if ((q.budgetPerPerson != null || q.budgetMin != null) && !p.get('sort')) {
    p.set('sort', 'budget_fit')
  }
  return canonicalBrowseQueryKey(p)
}

export { BROWSE_OVERSEAS_HUB_FETCH_LIMIT }
