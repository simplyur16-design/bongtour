import { isAirHotelRegionBucketParam } from '@/lib/air-hotel-region-filter'
import type { OverseasGeoFilterBanner } from '@/lib/overseas-destination-browse'
import { searchParamsRecordToUrlSearchParams } from '@/lib/products-browse-hub-query'
import { parseBrowseQuery } from '@/lib/products-browse-query'

function spGet(sp: URLSearchParams, key: string): string {
  return (sp.get(key) ?? '').trim()
}

/** 해외·항공+호텔 허브 — 권역 미리보기 vs 좁힌 전체 목록 (SSR·CSR 동일 판정) */
export function computeHubFocusedResults(opts: {
  pathname: string
  defaultScope?: 'overseas' | 'domestic'
  searchParams: URLSearchParams
  overseasGeoFilterBanner?: OverseasGeoFilterBanner | null
}): boolean {
  const isOverseasProductsHub = opts.pathname === '/travel/overseas' && opts.defaultScope === 'overseas'
  const isAirHotelHub = opts.pathname === '/travel/air-hotel'
  const useHubClientSidebarFilter = isOverseasProductsHub || isAirHotelHub
  if (!useHubClientSidebarFilter) return false

  const q = parseBrowseQuery(new URLSearchParams(opts.searchParams.toString()))
  const hasMegaGeo = Boolean((q.region ?? '').trim() || (q.country ?? '').trim())
  const hasDestinationFilter = Boolean(
    opts.overseasGeoFilterBanner || (q.city ?? '').trim() || spGet(opts.searchParams, 'destination'),
  )
  const hasGeoFilter = Boolean(hasMegaGeo || hasDestinationFilter || spGet(opts.searchParams, 'hubSeason'))
  const hasHubProductFilters = Boolean(q.noOptionalTour || q.noShopping || (q.airlines?.length ?? 0) > 0)
  const airHotelRegionFilter =
    isAirHotelHub && isAirHotelRegionBucketParam((q.region ?? '').trim()) ? (q.region ?? '').trim() : null

  return Boolean(
    hasGeoFilter || hasHubProductFilters || airHotelRegionFilter || (q.country ?? '').trim(),
  )
}

export function computeHubFocusedResultsFromRecord(
  sp: Record<string, string | string[] | undefined>,
  opts: Omit<Parameters<typeof computeHubFocusedResults>[0], 'searchParams'>,
): boolean {
  return computeHubFocusedResults({
    ...opts,
    searchParams: searchParamsRecordToUrlSearchParams(sp),
  })
}
