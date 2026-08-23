'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BrowseSort } from '@/lib/products-browse-filter'
import {
  mergeBrowseQuery,
  parseBrowseQuery,
  serializeBrowseQuery,
  type BrowseQueryState,
} from '@/lib/products-browse-query'
import ProductsPageLayout from '@/components/products/layout/ProductsPageLayout'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import ProductFilterForm, { type BrowseFacets } from '@/components/products/filter/ProductFilterForm'
import ProductHubInlineFilterBar from '@/components/products/filter/ProductHubInlineFilterBar'
import ProductFilterMobileDrawer from '@/components/products/filter/ProductFilterMobileDrawer'
import ProductFilterChips, { buildFilterChips } from '@/components/products/ProductFilterChips'
import ProductSortBar from '@/components/products/ProductSortBar'
import ProductResultsList, { type ResultItem } from '@/components/products/ProductResultsList'
import type { OverseasGeoFilterBanner } from '@/lib/overseas-destination-browse'
import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import { sortProductsBySeason } from '@/lib/product-sort'
import {
  buildAirHotelRegionChips,
  isAirHotelRegionBucketParam,
  resolveAirHotelItemBucket,
} from '@/lib/air-hotel-region-filter'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import AirHotelRegionChipRow from '@/components/products/AirHotelRegionChipRow'
import {
  buildAirHotelHubBrowseQueryKey,
  buildOverseasHubBrowseQueryKey,
  buildProductsBrowseQueryKey,
  normalizeAirHotelHubUrlSearchParams,
  searchParamsRecordToUrlSearchParams,
} from '@/lib/products-browse-hub-query'
import { computeHubFocusedResults } from '@/lib/hub-focused-results'
import { computeMegaMenuRegionCityGroupId } from '@/lib/overseas-mega-region-city-group'
import {
  filterBrowseItemsBySidebarFilters,
  sortBrowseItemsClient,
  type BrowseResultItemWithMeta,
} from '@/lib/products-browse-client-sidebar'
import { readProductsBrowseClientCache } from '@/lib/products-browse-client-cache'
import { fetchProductsBrowseClientJson } from '@/lib/products-browse-client-fetch'

type ApiOk = {
  ok: true
  total: number
  page: number
  limit: number
  items: ResultItem[]
  destinationTerms: string[]
  suggestedBudgetMax: number | null
  facets: BrowseFacets
}

type Props = {
  basePath?: string
  defaultScope?: 'overseas'
  pageTitle?: string
  /** 히어로가 이미 제목·설명을 쓰는 허브에서만: 상단 헤더 + 모바일 필터 바 옆 건수 문구 생략 */
  hidePageHeading?: boolean
  /** 해외 허브: 서유럽 섹션용 목적지 브리핑(서버 선별) */
  overseasEditorialBriefing?: OverseasEditorialBriefingPayload | null
  /** 추천 여행지·메가메뉴 도시/국가 필터 시 상단 제목·해제 */
  overseasGeoFilterBanner?: OverseasGeoFilterBanner | null
  /** 해외 허브 권역 그룹(일본 직후) 시즌 큐레이션 — RSC prefetch */
  overseasSeasonCurationSlides?: HomeSeasonPickDTO[] | null
  /** RSC prefetch — queryKey 일치 시 클라이언트 fetch 생략 */
  initialBrowse?: ApiOk | null
  initialBrowseQueryKey?: string | null
  /** RSC `searchParams` 스냅샷 — 첫 hydration에서 `useSearchParams()`와 SSOT 맞춤 */
  initialSearchParams?: Record<string, string | string[] | undefined> | null
  /** RSC에서 계산한 허브 focused 여부 — 미리보기 배너·권역 그룹 hydration 일치 */
  initialHubFocusedResults?: boolean
  /** RSC에서 계산한 메가메뉴 하위 지역 그룹 id — 섹션 분리 hydration 일치 */
  initialMegaMenuRegionCityGroupId?: string | null
  /** 대표(큰) 카드 로테이션 시드 — 새로고침마다 변경 */
  hubGalleryRotationSeed?: number
  /**
   * `/travel/overseas`·`/travel/air-hotel` 등 허브 — `useSearchParams()` 미사용.
   * (Suspense·soft nav 시 목록 state 리셋·fetch 취소 루프 방지)
   */
  hubBrowse?: boolean
}

type CoreProps = Props & {
  searchParamsString: string
  searchParamsHydrated: boolean
  onControlledSearchParamsChange?: (next: string) => void
}

function formatWon(n: number | null) {
  if (n == null) return '문의'
  return `${n.toLocaleString('ko-KR')}원~`
}

function syncTypeWithCategories(q: BrowseQueryState): BrowseQueryState {
  if (q.categories.length !== 1) return q
  const c = q.categories[0]
  if (c === 'air-hotel') return { ...q, type: 'air-hotel' }
  return q
}

/** 일반 여행 상담 CTA — `TravelInquiryForm` (`/inquiry?type=travel`) + `sourcePagePath` 추적용 */
function travelConsultInquiryHref(
  basePath: string,
  pathname: string,
  defaultScope: 'overseas' | undefined
): string {
  if (basePath === '/travel/air-hotel' || pathname === '/travel/air-hotel') {
    return `/inquiry?type=travel&source=${encodeURIComponent('/travel/air-hotel')}`
  }
  if (basePath === '/travel/overseas' || pathname === '/travel/overseas') {
    return `/inquiry?type=travel&source=${encodeURIComponent('/travel/overseas')}`
  }
  if (defaultScope === 'overseas') {
    return `/inquiry?type=travel&source=${encodeURIComponent('/travel/overseas')}`
  }
  return '/inquiry?type=travel'
}

function ProductsBrowseClientCore({
  basePath = '/products',
  defaultScope,
  pageTitle = '여행 상품',
  hidePageHeading = false,
  overseasEditorialBriefing = null,
  overseasGeoFilterBanner = null,
  overseasSeasonCurationSlides = null,
  initialBrowse = null,
  initialBrowseQueryKey = null,
  initialSearchParams = null,
  initialHubFocusedResults,
  initialMegaMenuRegionCityGroupId = null,
  hubGalleryRotationSeed = 0,
  searchParamsString,
  searchParamsHydrated,
  onControlledSearchParamsChange,
}: CoreProps) {
  const router = useRouter()
  const pathname = usePathname() ?? ''

  const commitSearchParams = useCallback(
    (sp: URLSearchParams) => {
      const qsNext = sp.toString()
      router.replace(qsNext ? `${basePath}?${qsNext}` : basePath, { scroll: false })
      onControlledSearchParamsChange?.(qsNext)
    },
    [basePath, onControlledSearchParamsChange, router],
  )

  /** hydration 직후 `usePathname()`이 비는 경우가 있어 허브 판별은 `basePath` SSOT */
  const hubPathname =
    basePath === '/travel/overseas' || basePath === '/travel/air-hotel' ? basePath : pathname

  const searchParams = useMemo(
    () => new URLSearchParams(searchParamsString),
    [searchParamsString],
  )

  const qs = searchParamsString

  const isAirHotelHub = hubPathname === '/travel/air-hotel'
  const suppressHeadingToolbarGap = false

  /** 항공+호텔: `country` 등은 클라이언트 필터 — 동일 목록 재요청 방지용 fetch 키 */
  const isOverseasProductsHub = hubPathname === '/travel/overseas' && defaultScope === 'overseas'
  const useHubClientSidebarFilter = isOverseasProductsHub || isAirHotelHub

  const browseApiQueryKey = useMemo(() => {
    if (isAirHotelHub) return buildAirHotelHubBrowseQueryKey(searchParamsString)
    if (isOverseasProductsHub) return buildOverseasHubBrowseQueryKey(searchParamsString)
    return buildProductsBrowseQueryKey(searchParamsString, defaultScope)
  }, [isAirHotelHub, isOverseasProductsHub, searchParamsString, defaultScope])

  const seedFromServer = Boolean(
    initialBrowse?.ok && initialBrowseQueryKey && initialBrowseQueryKey === browseApiQueryKey,
  )

  const seedFromClientCache = useMemo(() => {
    if (seedFromServer) return null
    const hit = readProductsBrowseClientCache<ApiOk>(browseApiQueryKey)
    return hit?.ok && Array.isArray(hit.items) ? hit : null
  }, [browseApiQueryKey, seedFromServer])

  const emptyStateTravelInquiryHref = useMemo(
    () => travelConsultInquiryHref(basePath, pathname, defaultScope),
    [basePath, pathname, defaultScope]
  )

  const q = useMemo(() => parseBrowseQuery(new URLSearchParams(searchParams.toString())), [searchParams])

  const [data, setData] = useState<ApiOk | null>(
    seedFromServer ? initialBrowse : seedFromClientCache,
  )
  const [loading, setLoading] = useState(!seedFromServer && !seedFromClientCache)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<BrowseQueryState>(q)
  const [airlineShowAll, setAirlineShowAll] = useState(false)

  const setHubSeasonQuery = useCallback(
    (slug: string | null) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (slug) sp.set('hubSeason', slug)
      else sp.delete('hubSeason')
      if (defaultScope && !sp.get('scope')) sp.set('scope', defaultScope)
      commitSearchParams(sp)
    },
    [commitSearchParams, defaultScope, searchParams],
  )

  useEffect(() => {
    if (drawerOpen) setDraft(parseBrowseQuery(new URLSearchParams(searchParams.toString())))
  }, [drawerOpen, searchParams])

  /** Persona 카드 `?destination=` → browse API용 `city`로 정규화 */
  useEffect(() => {
    if (hubPathname !== '/travel/overseas' || defaultScope !== 'overseas') return
    const dest = (searchParams.get('destination') ?? '').trim()
    const city = (searchParams.get('city') ?? '').trim()
    if (!dest || city) return
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('city', dest)
    sp.delete('destination')
    if (defaultScope && !sp.get('scope')) sp.set('scope', defaultScope)
    commitSearchParams(sp)
  }, [basePath, commitSearchParams, defaultScope, hubPathname, searchParams])

  const initialBrowseSeedRef = useRef(initialBrowse)
  const initialBrowseQueryKeyRef = useRef(initialBrowseQueryKey)
  initialBrowseSeedRef.current = initialBrowse
  initialBrowseQueryKeyRef.current = initialBrowseQueryKey

  useEffect(() => {
    const urlKey = browseApiQueryKey
    let cancelled = false

    const serverSeed =
      initialBrowseSeedRef.current?.ok && initialBrowseQueryKeyRef.current === urlKey
        ? initialBrowseSeedRef.current
        : null
    const seeded = serverSeed ?? readProductsBrowseClientCache<ApiOk>(urlKey)

    if (seeded?.ok) {
      setData(seeded)
      setError(null)
      setLoading(false)
    } else {
      setLoading(true)
      setError(null)
    }

    const perfClient = process.env.NEXT_PUBLIC_BONGTOUR_PERF_LOG === '1' // PERF-LOG: 측정 후 제거
    const tFetch0 = perfClient ? performance.now() : 0 // PERF-LOG: 측정 후 제거

    void fetchProductsBrowseClientJson(urlKey)
      .then((json) => {
        if (cancelled) return
        if (perfClient) {
          console.log(
            '[browse-client-perf]',
            JSON.stringify({ urlKey, clientFetchMs: Math.round(performance.now() - tFetch0) }),
          ) // PERF-LOG: 측정 후 제거
        }
        setData(json as ApiOk)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        const cached = readProductsBrowseClientCache<ApiOk>(urlKey)
        if (cached?.ok) {
          setData(cached)
          setError(null)
        } else if (serverSeed?.ok) {
          setData(serverSeed)
          setError(null)
        } else {
          setError(e instanceof Error ? e.message : '네트워크 오류가 발생했습니다.')
          setData(null)
        }
      })
      .finally(() => {
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [browseApiQueryKey])

  const navigate = useCallback(
    (next: BrowseQueryState) => {
      const synced = syncTypeWithCategories(next)
      const params = new URLSearchParams(serializeBrowseQuery(synced))
      if (defaultScope && !params.get('scope')) params.set('scope', defaultScope)
      const hubKeep = (searchParams.get('hubSeason') ?? '').trim()
      if (hubKeep && hubPathname === '/travel/overseas' && defaultScope === 'overseas') {
        params.set('hubSeason', hubKeep)
      }
      commitSearchParams(params)
    },
    [commitSearchParams, defaultScope, hubPathname, searchParams]
  )

  const onPatch = useCallback(
    (patch: Partial<BrowseQueryState>) => {
      navigate(mergeBrowseQuery(q, { ...patch, page: patch.page ?? 1 }))
    },
    [navigate, q]
  )

  const clearMegaParams = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString())
    ;[
      'confirmed',
      'noOptionalTour',
      'noShopping',
      'freeSchedule',
      'brand',
      'brands',
      'category',
      'categories',
      'travelGrade',
      'travelGrades',
      'companion',
      'companions',
      'airline',
      'airlines',
      'departHour',
      'departHours',
      'departDay',
      'departWeekdays',
      'budgetPerPerson',
      'budgetMin',
      'sort',
      'page',
      'region',
      'country',
      'city',
      'destination',
      'hubSeason',
      'sportsTheme',
    ].forEach((k) => sp.delete(k))
    if (defaultScope) sp.set('scope', defaultScope)
    commitSearchParams(sp)
  }, [commitSearchParams, defaultScope, searchParams])

  const clearAllFilters = useCallback(() => {
    clearMegaParams()
  }, [clearMegaParams])

  const removeChip = useCallback(
    (key: string) => {
      if (key === 'noOptionalTour') onPatch({ noOptionalTour: false })
      else if (key === 'noShopping') onPatch({ noShopping: false })
      else if (key === 'budget') onPatch({ budgetMin: null, budgetPerPerson: null, sort: 'popular' })
      else if (key.startsWith('brand:')) {
        const k = key.slice('brand:'.length)
        onPatch({ brands: q.brands.filter((b) => b !== k) })
      } else if (key.startsWith('cat:')) {
        const k = key.slice('cat:'.length)
        onPatch({ categories: q.categories.filter((c) => c !== k) })
      } else if (key.startsWith('air:')) {
        const k = key.slice('air:'.length)
        onPatch({ airlines: q.airlines.filter((a) => a !== k) })
      } else if (key.startsWith('hour:')) {
        const k = key.slice('hour:'.length)
        onPatch({ departHours: q.departHours.filter((h) => h !== k) })
      } else if (key.startsWith('day:')) {
        const d = parseInt(key.slice('day:'.length), 10)
        onPatch({ departWeekdays: q.departWeekdays.filter((x) => x !== d) })
      } else if (key === 'countryFilter') {
        onPatch({ country: null, page: 1 })
      } else if (key === 'hubSeason') {
        setHubSeasonQuery(null)
      } else if (key === 'sportsTheme') {
        onPatch({ sportsTheme: null, page: 1 })
      } else if (key === 'sportsThemeRegion') {
        onPatch({ region: null, sportsTheme: null, page: 1 })
      }
    },
    [onPatch, q, setHubSeasonQuery]
  )

  const chips = useMemo(() => {
    let base = buildFilterChips(q)
    if (useHubClientSidebarFilter) {
      base = base.filter((c) => c.key !== 'noOptionalTour' && c.key !== 'noShopping')
    }
    const hs = (searchParams.get('hubSeason') ?? '').trim().toLowerCase()
    if (!hs) return base
    const lab = koreanCountryLabelFromBrowseSlug(hs) ?? hs
    return [...base, { key: 'hubSeason', label: `시즌:${lab}` }]
  }, [q, searchParams, useHubClientSidebarFilter])

  const budgetActive = q.budgetPerPerson != null || q.budgetMin != null

  const hasNonBudgetFilters = useMemo(
    () =>
      (q.categories?.length ?? 0) > 0 ||
      (q.brands?.length ?? 0) > 0 ||
      (q.airlines?.length ?? 0) > 0 ||
      q.noOptionalTour ||
      q.noShopping ||
      (q.departHours?.length ?? 0) > 0 ||
      (q.departWeekdays?.length ?? 0) > 0 ||
      q.tripDays != null ||
      (q.departMonth != null && q.departMonth !== '') ||
      Boolean(q.region?.trim()) ||
      Boolean(q.country?.trim()) ||
      Boolean(q.city?.trim()) ||
      Boolean(q.sportsTheme?.trim()) ||
      Boolean((searchParams.get('hubSeason') ?? '').trim()) ||
      Boolean(q.regionPref?.trim()) ||
      Boolean(q.type?.trim()),
    [q, searchParams]
  )

  const sort: BrowseSort =
    (q.sort as BrowseSort) || (q.budgetPerPerson != null || q.budgetMin != null ? 'budget_fit' : 'popular')

  const scopeFromUrl = searchParams.get('scope')
  const isOverseasBrowse =
    (hubPathname === '/travel/overseas' && defaultScope === 'overseas') || scopeFromUrl === 'overseas'

  const airHotelRegionFilter = useMemo(() => {
    const region = q.region?.trim() ?? ''
    if (isAirHotelRegionBucketParam(region)) return region
    return null
  }, [q.region])

  const itemsAfterAirHotelCountry = useMemo(() => {
    if (!data?.items) return [] as BrowseResultItemWithMeta[]
    if (!isAirHotelHub) return data.items as BrowseResultItemWithMeta[]
    const items = data.items as BrowseResultItemWithMeta[]
    if (airHotelRegionFilter) {
      return items.filter((it) => resolveAirHotelItemBucket(it.overseasBucket) === airHotelRegionFilter)
    }
    const legacyCountry = q.country?.trim()
    if (legacyCountry) {
      return items.filter((it) => (it.browseCountry ?? '').trim() === legacyCountry)
    }
    return items
  }, [data?.items, isAirHotelHub, airHotelRegionFilter, q.country])

  const itemsAfterHubSidebar = useMemo(() => {
    let items = itemsAfterAirHotelCountry
    if (useHubClientSidebarFilter) {
      items = filterBrowseItemsBySidebarFilters(items, q)
      if (sort !== 'popular') {
        items = sortBrowseItemsClient(items, sort, q.budgetPerPerson)
      }
    }
    return items
  }, [itemsAfterAirHotelCountry, useHubClientSidebarFilter, q, sort])

  const displayedTotal = useMemo(() => {
    if (!data) return 0
    if (useHubClientSidebarFilter) return itemsAfterHubSidebar.length
    if (isAirHotelHub && (airHotelRegionFilter || q.country?.trim())) return itemsAfterHubSidebar.length
    return data.total
  }, [data, useHubClientSidebarFilter, isAirHotelHub, airHotelRegionFilter, q.country, itemsAfterHubSidebar.length])

  const browsePresented = useMemo(() => {
    if (!data) return { items: [] as ResultItem[], seasonalPickIds: null as ReadonlySet<string> | null }
    const baseItems = itemsAfterHubSidebar
    if (!isOverseasBrowse || budgetActive || sort !== 'popular') {
      return { items: baseItems, seasonalPickIds: null }
    }
    const seoulMonth = Number(getSeoulYearMonthNow().split('-')[1]) || 1
    const { items, seasonalPickIds } = sortProductsBySeason(baseItems, seoulMonth)
    return { items, seasonalPickIds }
  }, [data, isOverseasBrowse, budgetActive, sort, itemsAfterHubSidebar])

  const airHotelRegionChips = useMemo(() => {
    if (!isAirHotelHub || !data?.items?.length) return []
    return buildAirHotelRegionChips(data.items)
  }, [isAirHotelHub, data?.items])

  const listedProductCount = useMemo(() => {
    if (!data) return null
    return displayedTotal
  }, [data, displayedTotal])

  /** 메가메뉴 권역·나라 선택 — 시즌 허브 카드/시즌 추천 상품 숨김용 */
  const hasMegaGeo = Boolean((q.region ?? '').trim() || (q.country ?? '').trim())
  const hasDestinationFilter = Boolean(
    overseasGeoFilterBanner || (q.city ?? '').trim() || (searchParams.get('destination') ?? '').trim(),
  )
  /** 나라·권역·필터로 좁힌 뒤 — 권역 그룹 해제·섹션 미리보기 해제 */
  const hubFocusedResultsLive = useMemo(
    () =>
      computeHubFocusedResults({
        pathname: hubPathname,
        defaultScope,
        searchParams,
        overseasGeoFilterBanner,
      }),
    [hubPathname, defaultScope, searchParams, overseasGeoFilterBanner],
  )
  const hubFocusedResults =
    initialHubFocusedResults != null && !searchParamsHydrated
      ? initialHubFocusedResults
      : hubFocusedResultsLive

  const megaMenuRegionCityGroupIdLive = useMemo(
    () =>
      computeMegaMenuRegionCityGroupId({
        pathname: hubPathname,
        defaultScope,
        searchParams,
        overseasGeoFilterBanner,
      }),
    [hubPathname, defaultScope, searchParams, overseasGeoFilterBanner],
  )
  const megaMenuRegionCityGroupId =
    initialMegaMenuRegionCityGroupId != null && !searchParamsHydrated
      ? initialMegaMenuRegionCityGroupId
      : megaMenuRegionCityGroupIdLive

  const isSportsThemeRegion = (q.region ?? '').trim() === 'sports_theme'
  const sportsThemeFilter = (q.sportsTheme ?? '').trim() || null
  const groupSportsThemeByCategory = isSportsThemeRegion && !sportsThemeFilter && hubFocusedResults

  const showOverseasSeasonCuration =
    isOverseasProductsHub &&
    !hasMegaGeo &&
    !hasDestinationFilter &&
    !hubFocusedResults &&
    !(searchParams.get('hubSeason') ?? '').trim() &&
    (overseasSeasonCurationSlides?.length ?? 0) > 0

  const summary = hidePageHeading
    ? null
    : (
        <header className="border-b border-slate-200 pb-4">
          <nav className="text-xs text-slate-500">
            <Link href="/" className="font-medium text-slate-600 hover:underline">
              홈
            </Link>
            <span className="mx-1.5 text-slate-300">/</span>
            {pageTitle}
          </nav>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{pageTitle}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {q.region && (
              <span>
                선택 지역: {q.region}
                {q.country ? ` · ${q.country}` : ''}
                {q.city ? ` · ${q.city}` : ''}
              </span>
            )}
            {!q.region && (
              <span>
                등록된 상품을 조건에 맞게 찾습니다.
              </span>
            )}
          </p>
          {data && (
            <p className="mt-2 text-sm font-medium text-slate-800">
              조건에 맞는 상품 {(listedProductCount ?? data.total).toLocaleString('ko-KR')}건
              {data.total > 0 &&
                data.page > 1 &&
                !(
                  (basePath === '/travel/overseas' && defaultScope === 'overseas') ||
                  basePath === '/travel/air-hotel'
                ) && (
                <span className="text-slate-500">
                  {' '}
                  (페이지 {data.page})
                </span>
              )}
            </p>
          )}
        </header>
      )

  const facets: BrowseFacets = data?.facets ?? {
    brands: [],
    airlines: [],
    hasDepartureTimeData: false,
    hasWeekdayData: false,
  }

  const toolbar = useHubClientSidebarFilter ? (
    <div className={suppressHeadingToolbarGap ? 'mt-0' : 'mt-2'}>
      <ProductHubInlineFilterBar
        q={q}
        facets={facets}
        sort={sort}
        budgetActive={budgetActive}
        listedCount={listedProductCount ?? data?.total ?? null}
        onPatch={onPatch}
        onSortChange={(next) => onPatch({ sort: next, page: 1 })}
      />
    </div>
  ) : (
    <div className={suppressHeadingToolbarGap ? 'mt-0' : 'mt-2'}>
      <ProductSortBar
        sort={sort}
        budgetActive={budgetActive}
        onChange={(next) => onPatch({ sort: next, page: 1 })}
      />
    </div>
  )

  const airHotelRegionChipRow =
    isAirHotelHub && airHotelRegionChips.length > 0 ? (
      <AirHotelRegionChipRow
        chips={airHotelRegionChips}
        selectedBucketId={airHotelRegionFilter}
        onSelectAll={() => onPatch({ region: null, country: null, page: 1 })}
        onSelectBucket={(bucketId) => onPatch({ region: bucketId, country: null, page: 1 })}
      />
    ) : null

  const results = (
    <>
      {airHotelRegionChipRow}
      <div className="relative">
        {loading && data && (
          <div
            className="pointer-events-none absolute right-0 top-0 z-10 flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs text-slate-600 shadow-sm"
            aria-live="polite"
          >
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600"
              aria-hidden
            />
            불러오는 중…
          </div>
        )}
        {loading && (data?.items?.length ?? 0) === 0 && (
          <p className="mt-10 text-center text-sm text-slate-500">불러오는 중…</p>
        )}
        {error && (
          <div
            className="mt-10 w-full rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-6 text-center text-sm text-rose-900"
            role="alert"
          >
            <p className="font-semibold">{error}</p>
            <p className="mt-2 text-rose-800/90">
              서버가 일시적으로 바쁠 수 있습니다. 새로고침 후에도 같으면 잠시 뒤 다시 확인해 주세요.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-50"
            >
              새로고침
            </button>
          </div>
        )}
        {!loading && data && displayedTotal === 0 && budgetActive && (
        <div className="mt-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-6 text-sm text-slate-900">
          <p className="font-semibold">입력한 1인당 예산 범위에 맞는 상품이 없습니다.</p>
          <p className="mt-2 text-slate-700">예산 범위를 조금 넓히거나 다른 조건과 함께 다시 찾아보세요.</p>
          {data.suggestedBudgetMax != null && q.budgetPerPerson != null && (
            <p className="mt-3">
              참고: 현재 데이터에서 가장 가까운 상위 가격대는 약{' '}
              <strong>{data.suggestedBudgetMax.toLocaleString('ko-KR')}원</strong>부터 있습니다.
            </p>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-4 inline-flex rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-100"
          >
            필터 초기화
          </button>
        </div>
      )}
        {!loading && data && displayedTotal === 0 && !budgetActive && hasNonBudgetFilters && (
        <div className="mt-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-6 text-sm text-slate-900">
          <p className="font-semibold">
            {hasMegaGeo || hasDestinationFilter
              ? '등록된 여행상품이 없습니다.'
              : '선택한 조건에 맞는 상품이 없습니다.'}
          </p>
          <p className="mt-2 text-slate-700">
            {hasMegaGeo || hasDestinationFilter
              ? '현재 이 목적지·지역으로 노출되는 상품이 없습니다. 다른 지역을 선택하거나 필터를 조정해 보세요.'
              : '필터를 조정하거나 초기화한 뒤 다시 찾아보세요.'}
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-4 inline-flex rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-100"
          >
            필터 초기화
          </button>
        </div>
      )}
        {!loading &&
          data &&
          displayedTotal > 0 &&
          isAirHotelHub &&
          (airHotelRegionFilter || q.country?.trim()) &&
          browsePresented.items.length === 0 && (
          <div className="mt-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-6 text-sm text-slate-900">
            <p className="font-semibold">선택한 권역에 해당하는 항공+호텔 상품이 없습니다.</p>
            <p className="mt-2 text-slate-700">다른 권역을 선택하거나 전체로 돌아가 보세요.</p>
            <button
              type="button"
              onClick={() => onPatch({ region: null, country: null, page: 1 })}
              className="mt-4 inline-flex rounded-full border border-teal-600 bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
            >
              전체 보기
            </button>
          </div>
        )}
        {!loading &&
          data &&
          displayedTotal === 0 &&
          !budgetActive &&
          !hasNonBudgetFilters &&
          !(
            hubPathname === '/travel/overseas' &&
            defaultScope === 'overseas' &&
            !hasMegaGeo
          ) && (
        <div className="mt-10 w-full rounded-xl border border-bt-border bg-bt-surface px-4 py-8 text-center text-sm text-bt-muted">
          <p className="text-base font-semibold text-bt-ink">등록된 여행상품이 아직 없습니다.</p>
          <p className="mt-3 leading-relaxed">준비 중인 상품은 순차적으로 업데이트됩니다.</p>
          <p className="mt-4 leading-relaxed">
            필요한 경우{' '}
            <Link href="/support" className="font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline">
              고객지원
            </Link>
            {' · '}
            <Link
              href={emptyStateTravelInquiryHref}
              className="font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline"
            >
              상담 신청
            </Link>
            을 이용하실 수 있습니다.
          </p>
        </div>
      )}
        {data && browsePresented.items.length > 0 && (
          <div className={loading ? 'opacity-60 transition-opacity duration-200' : ''}>
            <ProductResultsList
              items={browsePresented.items}
              formatWon={formatWon}
              groupOverseasByRegion={
                basePath === '/travel/overseas' && defaultScope === 'overseas' && !hubFocusedResults
              }
              groupAirHotelByCountry={hubPathname === '/travel/air-hotel' && !hubFocusedResults}
              overseasEditorialBriefing={overseasEditorialBriefing}
              overseasSeasonCurationSlides={
                showOverseasSeasonCuration ? overseasSeasonCurationSlides : null
              }
              seasonalPickIds={browsePresented.seasonalPickIds}
              overseasFlatByCountrySlug={hubFocusedResults ? q.country?.trim() || null : null}
              hubCompareGridLayout={useHubClientSidebarFilter}
              hubSectionPreview={useHubClientSidebarFilter && !hubFocusedResults}
              hubGalleryRotationSeed={hubGalleryRotationSeed}
              megaMenuRegionCityGroupId={megaMenuRegionCityGroupId}
              groupSportsThemeByCategory={groupSportsThemeByCategory}
              interleaveEsimNativeCards={
                (basePath === '/travel/overseas' && defaultScope === 'overseas') ||
                hubPathname === '/travel/air-hotel'
              }
            />
            {data.total > data.limit &&
              !(
                (basePath === '/travel/overseas' && defaultScope === 'overseas') ||
                basePath === '/travel/air-hotel'
              ) && (
              <div className="mt-10 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={data.page <= 1}
                  onClick={() => onPatch({ page: Math.max(1, data.page - 1) })}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-40"
                >
                  이전
                </button>
                <span className="text-sm text-slate-600">
                  {data.page} / {Math.ceil(data.total / data.limit)}
                </span>
                <button
                  type="button"
                  disabled={data.page * data.limit >= data.total}
                  onClick={() => onPatch({ page: data.page + 1 })}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )

  const overseasDestinationBanner =
    isOverseasProductsHub && overseasGeoFilterBanner ? (
      <div
        className={`${SITE_CONTENT_CLASS} mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bt-border-soft bg-white/95 px-4 py-3 shadow-sm`}
      >
        <h2 className="text-lg font-bold tracking-tight text-bt-text-navy sm:text-xl">
          {overseasGeoFilterBanner.title}
        </h2>
        <Link
          href="/travel/overseas"
          className="inline-flex shrink-0 items-center rounded-full border border-bt-border-strong px-3.5 py-1.5 text-sm font-semibold text-bt-text-muted-lavender transition hover:bg-bt-surface-soft hover:text-bt-text-navy"
        >
          전체 상품 보기
        </Link>
      </div>
    ) : null

  const mobileBar = (
    <div
      className={`mb-4 flex items-center gap-2 ${hidePageHeading ? 'justify-start' : 'justify-between'}`}
    >
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm"
      >
        필터
      </button>
      {!hidePageHeading ? (
        <span className="text-xs text-slate-500">
          {data ? `${listedProductCount ?? data.total}건` : ''}
        </span>
      ) : isAirHotelHub && data ? (
        <span className="text-xs text-slate-500">{`${listedProductCount ?? data.total}건`}</span>
      ) : null}
    </div>
  )

  if (useHubClientSidebarFilter) {
    return (
      <>
        {overseasDestinationBanner}
        <ProductsPageLayout
          summary={summary}
          chips={
            <ProductFilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllFilters} />
          }
          sidebar={null}
          toolbar={toolbar}
          results={results}
          mobileFilterBar={null}
        />
      </>
    )
  }

  return (
    <>
      {overseasDestinationBanner}
      <ProductsPageLayout
        summary={summary}
        chips={
          <ProductFilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllFilters} />
        }
        sidebar={
          <ProductFilterForm
            q={q}
            facets={facets}
            onPatch={onPatch}
            airlineShowAll={airlineShowAll}
            setAirlineShowAll={setAirlineShowAll}
            travelContext="overseas"
          />
        }
        toolbar={toolbar}
        results={results}
        mobileFilterBar={mobileBar}
      />
      <ProductFilterMobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        facets={facets}
        draft={draft}
        setDraft={setDraft}
        airlineShowAll={airlineShowAll}
        setAirlineShowAll={setAirlineShowAll}
        onApply={() => {
          navigate(syncTypeWithCategories(draft))
          setDrawerOpen(false)
        }}
        onReset={() => {
          const sp = new URLSearchParams(searchParams.toString())
          ;[
            'confirmed',
            'noOptionalTour',
            'noShopping',
            'freeSchedule',
            'brand',
            'brands',
            'category',
            'categories',
            'travelGrade',
            'travelGrades',
            'companion',
            'companions',
            'airline',
            'airlines',
            'departHour',
            'departHours',
            'departDay',
            'departWeekdays',
            'budgetPerPerson',
            'budgetMin',
            'sort',
            'page',
          ].forEach((k) => sp.delete(k))
          setDraft(parseBrowseQuery(new URLSearchParams(sp.toString())))
          if (defaultScope) sp.set('scope', defaultScope)
          commitSearchParams(sp)
          setDrawerOpen(false)
        }}
      />
    </>
  )
}

function ProductsBrowseClientWithHook(props: Props) {
  const searchParamsFromHook = useSearchParams() ?? new URLSearchParams()
  const initialSearchParamsStringRef = useRef(
    props.initialSearchParams
      ? searchParamsRecordToUrlSearchParams(props.initialSearchParams).toString()
      : '',
  )
  const hookSearchParamsString = searchParamsFromHook.toString()
  const searchParamsString = hookSearchParamsString || initialSearchParamsStringRef.current
  const searchParamsHydrated =
    hookSearchParamsString.length > 0 || !initialSearchParamsStringRef.current

  return (
    <ProductsBrowseClientCore
      {...props}
      searchParamsString={searchParamsString}
      searchParamsHydrated={searchParamsHydrated}
    />
  )
}

function ProductsBrowseClientHub(props: Props) {
  const initialQs = props.initialSearchParams
    ? searchParamsRecordToUrlSearchParams(props.initialSearchParams).toString()
    : ''
  const [searchParamsString, setSearchParamsString] = useState(initialQs)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.location.search.replace(/^\?/, '')
    if (props.basePath === '/travel/air-hotel') {
      // REGRESSION-FREEZE[air-hotel-hub-isr-cdn]: client URL normalize (no SSR redirect) — manifest
      const normalized = normalizeAirHotelHubUrlSearchParams(new URLSearchParams(raw))
      const qs = normalized.toString()
      if (qs !== raw) {
        window.history.replaceState(null, '', qs ? `${props.basePath}?${qs}` : props.basePath)
      }
      setSearchParamsString(qs)
      return
    }
    if (raw) {
      setSearchParamsString(raw)
      return
    }
    if (initialQs) setSearchParamsString(initialQs)
  }, [initialQs, props.basePath])

  return (
    <ProductsBrowseClientCore
      {...props}
      searchParamsString={searchParamsString}
      searchParamsHydrated
      onControlledSearchParamsChange={setSearchParamsString}
    />
  )
}

export default function ProductsBrowseClient(props: Props) {
  if (props.hubBrowse) {
    return <ProductsBrowseClientHub {...props} />
  }
  return <ProductsBrowseClientWithHook {...props} />
}
