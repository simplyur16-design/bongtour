'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import ProductFilterMobileDrawer from '@/components/products/filter/ProductFilterMobileDrawer'
import ProductFilterChips, { buildFilterChips } from '@/components/products/ProductFilterChips'
import ProductSortBar from '@/components/products/ProductSortBar'
import ProductResultsList, { ProductResultCard, type ResultItem } from '@/components/products/ProductResultsList'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'
import { sortProductsBySeason } from '@/lib/product-sort'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import HomeMobileHubSeasonCarousel from '@/app/components/home/HomeMobileHubSeasonCarousel'

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

/** 허브 페이지 browse 1회 요청 상한 — 전량(1000) 조회는 API·DB 부하만 키움 */
const BROWSE_HUB_FETCH_LIMIT = '30'
/** 항공+호텔: 나라별 칩 집계·클라이언트 필터용으로 browse 상한까지 한 번에 로드 */
const AIR_HOTEL_BROWSE_FETCH_LIMIT = '120'

/** 국내 허브(`/travel/domestic`)에서 browse·URL 정리 시 제거(레거시 링크 무시) */
const DOMESTIC_HUB_QUERY_STRIP_KEYS = [
  'dmPillar',
  'dmItem',
  'regionPref',
  'domesticTransport',
  'domesticSpecialTheme',
  'tripDays',
  'departMonth',
  'region',
  'country',
  'city',
  'brand',
  'brands',
  'airline',
  'airlines',
  'noOptionalTour',
  'noShopping',
  'departHour',
  'departHours',
  'departDay',
  'departWeekdays',
  'budgetPerPerson',
  'budgetMin',
  'categories',
  'category',
  'type',
  'page',
  'listingKind',
] as const

type Props = {
  basePath?: string
  defaultScope?: 'overseas' | 'domestic'
  pageTitle?: string
  /** 히어로가 이미 제목·설명을 쓰는 허브에서만: 상단 헤더 + 모바일 필터 바 옆 건수 문구 생략 */
  hidePageHeading?: boolean
  /** 해외 허브: 서유럽 섹션용 목적지 브리핑(서버 선별) */
  overseasEditorialBriefing?: OverseasEditorialBriefingPayload | null
  /** 해외 허브: 시즌 추천 순환 — 허브 기본 화면 상단 캐러셀(메가 지역 선택 시 목록 내 슬롯) */
  overseasSeasonCurationSlides?: HomeSeasonPickDTO[] | null
}

function formatWon(n: number | null) {
  if (n == null) return '문의'
  return `${n.toLocaleString('ko-KR')}원~`
}

/** 해외 허브 시즌 추천 상품 행 — `ProductResultsList` 나라별 줄과 동일한 가로 스크롤 */
const overseasHubSeasonProductRowClass =
  'mt-4 flex flex-nowrap gap-4 overflow-x-auto overflow-y-visible overscroll-x-contain pb-2 pt-0.5 snap-x snap-proximity [-ms-overflow-style:none] [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]'

function syncTypeWithCategories(q: BrowseQueryState): BrowseQueryState {
  if (q.categories.length !== 1) return q
  const c = q.categories[0]
  if (c === 'airtel') return { ...q, type: 'airtel' }
  if (c === 'private') return { ...q, type: 'private' }
  return q
}

/** 일반 여행 상담 CTA — `TravelInquiryForm` (`/inquiry?type=travel`) + `sourcePagePath` 추적용 */
function travelConsultInquiryHref(
  basePath: string,
  pathname: string,
  defaultScope: 'overseas' | 'domestic' | undefined
): string {
  if (basePath === '/travel/air-hotel' || pathname === '/travel/air-hotel') {
    return `/inquiry?type=travel&source=${encodeURIComponent('/travel/air-hotel')}`
  }
  if (basePath === '/travel/domestic' || pathname === '/travel/domestic') {
    return `/inquiry?type=travel&source=${encodeURIComponent('/travel/domestic')}`
  }
  if (basePath === '/travel/overseas' || pathname === '/travel/overseas') {
    return `/inquiry?type=travel&source=${encodeURIComponent('/travel/overseas')}`
  }
  if (defaultScope === 'overseas') {
    return `/inquiry?type=travel&source=${encodeURIComponent('/travel/overseas')}`
  }
  return '/inquiry?type=travel'
}

export default function ProductsBrowseClient({
  basePath = '/products',
  defaultScope,
  pageTitle = '여행 상품',
  hidePageHeading = false,
  overseasEditorialBriefing = null,
  overseasSeasonCurationSlides = null,
}: Props) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const qs = searchParams.toString()

  const isDomesticHub = pathname === '/travel/domestic' && defaultScope === 'domestic'
  const isAirHotelHub = pathname === '/travel/air-hotel'
  const suppressHeadingToolbarGap = hidePageHeading && isDomesticHub

  /** 항공+호텔: `country` 등은 클라이언트 필터 — 동일 목록 재요청 방지용 fetch 키 */
  const airHotelBrowseFetchKey = useMemo(() => {
    if (!isAirHotelHub) return null
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('country')
    sp.delete('region')
    sp.delete('city')
    return sp.toString()
  }, [isAirHotelHub, searchParams])

  const emptyStateTravelInquiryHref = useMemo(
    () => travelConsultInquiryHref(basePath, pathname, defaultScope),
    [basePath, pathname, defaultScope]
  )

  const q = useMemo(() => {
    if (isDomesticHub) {
      const sp = new URLSearchParams(searchParams.toString())
      for (const k of DOMESTIC_HUB_QUERY_STRIP_KEYS) sp.delete(k)
      return parseBrowseQuery(sp)
    }
    return parseBrowseQuery(new URLSearchParams(searchParams.toString()))
  }, [isDomesticHub, searchParams])

  const browseReloadKey = useMemo(() => {
    if (isDomesticHub) return searchParams.toString()
    if (isAirHotelHub) return airHotelBrowseFetchKey ?? ''
    return qs
  }, [isDomesticHub, isAirHotelHub, airHotelBrowseFetchKey, qs, searchParams])

  const [data, setData] = useState<ApiOk | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<BrowseQueryState>(q)
  const [airlineShowAll, setAirlineShowAll] = useState(false)
  const [seasonHubItems, setSeasonHubItems] = useState<ResultItem[]>([])
  const [seasonHubLoading, setSeasonHubLoading] = useState(false)

  const hubSeasonSlug = (searchParams.get('hubSeason') ?? '').trim().toLowerCase() || null

  const seasonHeading = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
    return `${currentMonth}~${nextMonth}월 떠나기 좋은 여행지`
  }, [])

  const curatedCountrySlugs = useMemo(() => {
    const list = overseasSeasonCurationSlides ?? []
    const s = new Set<string>()
    for (const c of list) {
      const slug = (c.resolvedProductCountrySlug ?? '').trim().toLowerCase()
      if (slug) s.add(slug)
    }
    return [...s]
  }, [overseasSeasonCurationSlides])

  const slugsForSeasonHubFetch = useMemo(() => {
    if (curatedCountrySlugs.length === 0) return [] as string[]
    if (hubSeasonSlug && curatedCountrySlugs.includes(hubSeasonSlug)) return [hubSeasonSlug]
    return curatedCountrySlugs
  }, [curatedCountrySlugs, hubSeasonSlug])

  useEffect(() => {
    const megaGeo =
      Boolean((q.region ?? '').trim() || (q.country ?? '').trim()) &&
      pathname === '/travel/overseas' &&
      defaultScope === 'overseas'
    if (
      pathname !== '/travel/overseas' ||
      defaultScope !== 'overseas' ||
      megaGeo ||
      slugsForSeasonHubFetch.length === 0
    ) {
      setSeasonHubItems([])
      setSeasonHubLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setSeasonHubLoading(true)
      try {
        const p = new URLSearchParams()
        p.set('scope', 'overseas')
        p.set('limit', '6')
        p.set('seasonCountries', slugsForSeasonHubFetch.join(','))
        const res = await fetch(`/api/products/browse?${p.toString()}`, { cache: 'no-store' })
        const json = (await res.json()) as ApiOk | { ok?: false }
        if (cancelled) return
        if (res.ok && json && typeof json === 'object' && 'ok' in json && (json as ApiOk).ok === true) {
          setSeasonHubItems((json as ApiOk).items ?? [])
        } else {
          setSeasonHubItems([])
        }
      } catch {
        if (!cancelled) setSeasonHubItems([])
      } finally {
        if (!cancelled) setSeasonHubLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pathname, defaultScope, q.country, q.region, slugsForSeasonHubFetch.join(',')])

  const setHubSeasonQuery = useCallback(
    (slug: string | null) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (slug) sp.set('hubSeason', slug)
      else sp.delete('hubSeason')
      if (defaultScope && !sp.get('scope')) sp.set('scope', defaultScope)
      router.replace(`${basePath}?${sp.toString()}`, { scroll: false })
    },
    [basePath, defaultScope, router, searchParams],
  )

  useEffect(() => {
    if (drawerOpen) setDraft(parseBrowseQuery(new URLSearchParams(searchParams.toString())))
  }, [drawerOpen, searchParams])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        let p: URLSearchParams
        if (isDomesticHub) {
          p = new URLSearchParams()
          p.set('scope', 'domestic')
          p.set('limit', BROWSE_HUB_FETCH_LIMIT)
          const sortRaw = searchParams.get('sort')
          if (
            sortRaw === 'budget_fit' ||
            sortRaw === 'price_asc' ||
            sortRaw === 'price_desc' ||
            sortRaw === 'departure_asc'
          ) {
            p.set('sort', sortRaw)
          }
        } else {
          p = new URLSearchParams(qs)
          if (defaultScope && !p.get('scope')) p.set('scope', defaultScope)
        }
        if (defaultScope === 'overseas' && pathname === '/travel/overseas') {
          p.delete('listingKind')
          p.set('limit', BROWSE_HUB_FETCH_LIMIT)
          p.delete('page')
        }
        if (pathname === '/travel/air-hotel') {
          p.set('limit', AIR_HOTEL_BROWSE_FETCH_LIMIT)
          p.delete('page')
          p.delete('country')
          p.delete('region')
          p.delete('city')
        }
        if ((q.budgetPerPerson != null || q.budgetMin != null) && !p.get('sort')) {
          p.set('sort', 'budget_fit')
        }
        const res = await fetch(`/api/products/browse?${p.toString()}`, { cache: 'no-store' })
        const json = (await res.json()) as ApiOk | { ok: false; error?: string }
        if (cancelled) return
        if (!res.ok || !('ok' in json) || json.ok === false) {
          setError(typeof (json as { error?: string }).error === 'string' ? (json as { error: string }).error : '목록을 불러오지 못했습니다.')
          setData(null)
          return
        }
        setData(json)
      } catch {
        if (!cancelled) {
          setError('네트워크 오류가 발생했습니다.')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [browseReloadKey, pathname, defaultScope, isDomesticHub, q.budgetMin, q.budgetPerPerson])

  const navigate = useCallback(
    (next: BrowseQueryState) => {
      if (isDomesticHub) {
        const params = new URLSearchParams()
        params.set('scope', 'domestic')
        params.set('limit', BROWSE_HUB_FETCH_LIMIT)
        const s = syncTypeWithCategories(next).sort
        if (s && s !== 'popular') params.set('sort', s)
        router.replace(`${basePath}?${params.toString()}`, { scroll: false })
        return
      }
      const synced = syncTypeWithCategories(next)
      const params = new URLSearchParams(serializeBrowseQuery(synced))
      if (defaultScope && !params.get('scope')) params.set('scope', defaultScope)
      const hubKeep = (searchParams.get('hubSeason') ?? '').trim()
      if (hubKeep && pathname === '/travel/overseas' && defaultScope === 'overseas') {
        params.set('hubSeason', hubKeep)
      }
      router.replace(`${basePath}?${params.toString()}`, { scroll: false })
    },
    [basePath, defaultScope, isDomesticHub, pathname, router, searchParams]
  )

  const onPatch = useCallback(
    (patch: Partial<BrowseQueryState>) => {
      navigate(mergeBrowseQuery(q, { ...patch, page: patch.page ?? 1 }))
    },
    [navigate, q]
  )

  const clearMegaParams = useCallback(() => {
    if (isDomesticHub) {
      const sp = new URLSearchParams()
      sp.set('scope', 'domestic')
      sp.set('limit', BROWSE_HUB_FETCH_LIMIT)
      router.replace(`${basePath}?${sp.toString()}`, { scroll: false })
      return
    }
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
      'hubSeason',
    ].forEach((k) => sp.delete(k))
    if (defaultScope) sp.set('scope', defaultScope)
    router.replace(`${basePath}?${sp.toString()}`, { scroll: false })
  }, [basePath, defaultScope, isDomesticHub, router, searchParams])

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
      }
    },
    [onPatch, q, setHubSeasonQuery]
  )

  const chips = useMemo(() => {
    const base = buildFilterChips(q)
    const hs = (searchParams.get('hubSeason') ?? '').trim().toLowerCase()
    if (!hs) return base
    const lab = koreanCountryLabelFromBrowseSlug(hs) ?? hs
    return [...base, { key: 'hubSeason', label: `시즌:${lab}` }]
  }, [q, searchParams])

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
      Boolean((searchParams.get('hubSeason') ?? '').trim()) ||
      Boolean(q.regionPref?.trim()) ||
      Boolean(q.type?.trim()),
    [q, searchParams]
  )

  const sort: BrowseSort =
    (q.sort as BrowseSort) || (q.budgetPerPerson != null || q.budgetMin != null ? 'budget_fit' : 'popular')

  const scopeFromUrl = searchParams.get('scope')
  const isOverseasBrowse =
    (pathname === '/travel/overseas' && defaultScope === 'overseas') || scopeFromUrl === 'overseas'

  const itemsAfterAirHotelCountry = useMemo(() => {
    if (!data?.items) return [] as ResultItem[]
    if (!isAirHotelHub) return data.items
    const c = q.country?.trim()
    if (!c) return data.items
    return data.items.filter((it) => (it.browseCountry ?? '').trim() === c)
  }, [data?.items, isAirHotelHub, q.country])

  const browsePresented = useMemo(() => {
    if (!data) return { items: [] as ResultItem[], seasonalPickIds: null as ReadonlySet<string> | null }
    const baseItems = itemsAfterAirHotelCountry
    if (!isOverseasBrowse || budgetActive || sort !== 'popular') {
      return { items: baseItems, seasonalPickIds: null }
    }
    const { items, seasonalPickIds } = sortProductsBySeason(baseItems, new Date().getMonth() + 1)
    return { items, seasonalPickIds }
  }, [data, isOverseasBrowse, budgetActive, sort, itemsAfterAirHotelCountry])

  const airHotelCountryChips = useMemo(() => {
    if (!isAirHotelHub || !data?.items?.length) return []
    const acc = new Map<string, { slug: string; label: string; count: number }>()
    for (const it of data.items) {
      const slug = (it.browseCountry ?? '').trim()
      if (!slug) continue
      const fromSlug = koreanCountryLabelFromBrowseSlug(slug)
      const label =
        fromSlug || (it.countryRowLabel ?? '').replace(/\s+/g, ' ').trim() || slug
      const prev = acc.get(slug)
      if (prev) prev.count += 1
      else acc.set(slug, { slug, label, count: 1 })
    }
    return [...acc.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
  }, [isAirHotelHub, data?.items])

  const listedProductCount = useMemo(() => {
    if (!data) return null
    if (isAirHotelHub && q.country?.trim()) return browsePresented.items.length
    return data.total
  }, [data, isAirHotelHub, q.country, browsePresented.items.length])

  const isOverseasProductsHub = pathname === '/travel/overseas' && defaultScope === 'overseas'
  /** 메가메뉴 권역·나라 선택 — 시즌 허브 카드/시즌 추천 상품 숨김용 */
  const hasMegaGeo = Boolean((q.region ?? '').trim() || (q.country ?? '').trim())
  const hasGeoFilter = Boolean(
    hasMegaGeo ||
      (q.city ?? '').trim() ||
      (searchParams.get('hubSeason') ?? '').trim(),
  )
  const showOverseasSidebar = !isOverseasProductsHub || hasGeoFilter
  const overseasHubWideLayout = isOverseasProductsHub && !hasMegaGeo

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
                {isDomesticHub ? '지역별로 등록된 상품을 확인할 수 있습니다.' : '등록된 상품을 조건에 맞게 찾습니다.'}
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
                  (basePath === '/travel/domestic' && defaultScope === 'domestic') ||
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

  const toolbar = (
    <div className={suppressHeadingToolbarGap ? 'mt-0' : 'mt-2'}>
      <ProductSortBar
        sort={sort}
        budgetActive={budgetActive}
        onChange={(next) => onPatch({ sort: next, page: 1 })}
      />
    </div>
  )

  const airHotelCountryChipRow =
    isAirHotelHub && airHotelCountryChips.length > 0 ? (
      <div
        className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="나라별 필터"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!q.country?.trim()}
          onClick={() => onPatch({ country: null, page: 1 })}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
            !q.country?.trim()
              ? 'border-teal-600 bg-teal-600 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
          }`}
        >
          전체
        </button>
        {airHotelCountryChips.map((c) => {
          const sel = q.country?.trim() === c.slug
          return (
            <button
              key={c.slug}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => onPatch({ country: c.slug, page: 1 })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                sel
                  ? 'border-teal-600 bg-teal-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
              }`}
            >
              {c.label}({c.count})
            </button>
          )
        })}
      </div>
    ) : null

  const results = (
    <>
      {airHotelCountryChipRow}
      {loading && <p className="mt-10 text-center text-sm text-slate-500">불러오는 중…</p>}
      {error && (
        <p className="mt-10 text-center text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
      {!loading &&
        data &&
        !hasMegaGeo &&
        pathname === '/travel/overseas' &&
        defaultScope === 'overseas' && (
          <div className="mb-10 space-y-8">
            {(overseasSeasonCurationSlides?.length ?? 0) > 0 ? (
              <HomeMobileHubSeasonCarousel slides={overseasSeasonCurationSlides ?? []} hideHeading />
            ) : null}
            <section aria-labelledby="overseas-hub-season-products-heading">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="overseas-hub-season-products-heading" className="text-xl font-bold text-slate-900">
                  {seasonHeading}
                </h2>
                {hubSeasonSlug ? (
                  <button
                    type="button"
                    onClick={() => setHubSeasonQuery(null)}
                    className="text-xs font-medium text-teal-700 underline-offset-2 hover:underline"
                  >
                    큐레이션 전체
                  </button>
                ) : null}
              </div>
              <div className={overseasHubSeasonProductRowClass}>
                {slugsForSeasonHubFetch.length === 0 ? (
                  <p className="shrink-0 py-6 text-sm text-slate-500">표시할 상품이 없습니다.</p>
                ) : seasonHubLoading ? (
                  <p className="shrink-0 py-6 text-sm text-slate-500">불러오는 중…</p>
                ) : seasonHubItems.length === 0 ? (
                  <p className="shrink-0 py-6 text-sm text-slate-500">표시할 상품이 없습니다.</p>
                ) : (
                  seasonHubItems.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className={
                        overseasHubWideLayout
                          ? 'w-[min(300px,42vw)] shrink-0 snap-start sm:w-[min(280px,30vw)]'
                          : 'w-[min(280px,78vw)] shrink-0 snap-start'
                      }
                    >
                      <ProductResultCard item={item} formatWon={formatWon} />
                    </div>
                  ))
                )}
              </div>
            </section>
            <h2 className="text-xl font-bold text-slate-900">전체 여행상품</h2>
          </div>
        )}
      {!loading && data && data.total === 0 && budgetActive && (
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
      {!loading && data && data.total === 0 && !budgetActive && hasNonBudgetFilters && (
        <div className="mt-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-6 text-sm text-slate-900">
          <p className="font-semibold">선택한 조건에 맞는 상품이 없습니다.</p>
          <p className="mt-2 text-slate-700">필터를 조정하거나 초기화한 뒤 다시 찾아보세요.</p>
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
        data.total > 0 &&
        isAirHotelHub &&
        q.country?.trim() &&
        browsePresented.items.length === 0 && (
          <div className="mt-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-6 text-sm text-slate-900">
            <p className="font-semibold">선택한 나라에 해당하는 항공+호텔 상품이 없습니다.</p>
            <p className="mt-2 text-slate-700">다른 나라를 선택하거나 전체로 돌아가 보세요.</p>
            <button
              type="button"
              onClick={() => onPatch({ country: null, page: 1 })}
              className="mt-4 inline-flex rounded-full border border-teal-600 bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
            >
              전체 보기
            </button>
          </div>
        )}
      {!loading &&
        data &&
        data.total === 0 &&
        !budgetActive &&
        !hasNonBudgetFilters &&
        !(
          pathname === '/travel/overseas' &&
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
      {!loading && data && browsePresented.items.length > 0 && (
        <>
          <ProductResultsList
            items={browsePresented.items}
            formatWon={formatWon}
            groupOverseasByRegion={basePath === '/travel/overseas' && defaultScope === 'overseas'}
            groupAirHotelByCountry={pathname === '/travel/air-hotel'}
            groupDomesticByRegion={isDomesticHub}
            overseasEditorialBriefing={overseasEditorialBriefing}
            overseasSeasonCurationSlides={
              pathname === '/travel/overseas' && defaultScope === 'overseas' ? null : overseasSeasonCurationSlides
            }
            seasonalPickIds={browsePresented.seasonalPickIds}
            overseasHubWideLayout={overseasHubWideLayout}
            overseasFlatByCountrySlug={q.country?.trim() || null}
          />
          {data.total > data.limit &&
            !(
              (basePath === '/travel/overseas' && defaultScope === 'overseas') ||
              (basePath === '/travel/domestic' && defaultScope === 'domestic') ||
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
        </>
      )}
    </>
  )

  const mobileBar =
    showOverseasSidebar ? (
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
    ) : null

  if (isDomesticHub) {
    return (
      <div className={`${SITE_CONTENT_CLASS} ${hidePageHeading ? 'pt-3 pb-6 sm:pt-4' : 'py-6'}`}>
        {summary != null ? <div className="mb-4">{summary}</div> : null}
        {toolbar}
        {results}
      </div>
    )
  }

  return (
    <>
      <ProductsPageLayout
        summary={summary}
        chips={
          <ProductFilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllFilters} />
        }
        sidebar={
          showOverseasSidebar ? (
            <ProductFilterForm
              q={q}
              facets={facets}
              onPatch={onPatch}
              airlineShowAll={airlineShowAll}
              setAirlineShowAll={setAirlineShowAll}
              travelContext={defaultScope === 'domestic' ? 'domestic' : 'overseas'}
            />
          ) : null
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
          router.replace(`${basePath}?${sp.toString()}`, { scroll: false })
          setDrawerOpen(false)
        }}
      />
    </>
  )
}
