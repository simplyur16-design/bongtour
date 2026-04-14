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
import ProductResultsList, { type ResultItem } from '@/components/products/ProductResultsList'
import type { MonthlyCurationMidPayload } from '@/lib/overseas-cms-public'
import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'

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
  /** 해외 허브: 동유럽 section 직후·미주 전 월간 큐레이션 전폭 1회 */
  monthlyCurationMid?: MonthlyCurationMidPayload | null
}

function formatWon(n: number | null) {
  if (n == null) return '문의'
  return `${n.toLocaleString('ko-KR')}원~`
}

function syncTypeWithCategories(q: BrowseQueryState): BrowseQueryState {
  if (q.categories.length !== 1) return q
  const c = q.categories[0]
  if (c === 'airtel') return { ...q, type: 'airtel' }
  if (c === 'private') return { ...q, type: 'private' }
  return q
}

export default function ProductsBrowseClient({
  basePath = '/products',
  defaultScope,
  pageTitle = '여행 상품',
  hidePageHeading = false,
  overseasEditorialBriefing = null,
  monthlyCurationMid = null,
}: Props) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const qs = searchParams.toString()

  const isDomesticHub = pathname === '/travel/domestic' && defaultScope === 'domestic'
  const suppressHeadingToolbarGap = hidePageHeading && isDomesticHub

  const q = useMemo(() => {
    if (isDomesticHub) {
      const sp = new URLSearchParams(searchParams.toString())
      for (const k of DOMESTIC_HUB_QUERY_STRIP_KEYS) sp.delete(k)
      return parseBrowseQuery(sp)
    }
    return parseBrowseQuery(new URLSearchParams(searchParams.toString()))
  }, [isDomesticHub, searchParams])

  const [data, setData] = useState<ApiOk | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<BrowseQueryState>(q)
  const [airlineShowAll, setAirlineShowAll] = useState(false)

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
          p.set('limit', '1000')
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
          p.set('limit', '1000')
          p.delete('page')
        }
        if (pathname === '/travel/air-hotel') {
          p.set('limit', '1000')
          p.delete('page')
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
  }, [qs, pathname, defaultScope, isDomesticHub, searchParams])

  const navigate = useCallback(
    (next: BrowseQueryState) => {
      if (isDomesticHub) {
        const params = new URLSearchParams()
        params.set('scope', 'domestic')
        params.set('limit', '1000')
        const s = syncTypeWithCategories(next).sort
        if (s && s !== 'popular') params.set('sort', s)
        router.replace(`${basePath}?${params.toString()}`, { scroll: false })
        return
      }
      const synced = syncTypeWithCategories(next)
      const params = new URLSearchParams(serializeBrowseQuery(synced))
      if (defaultScope && !params.get('scope')) params.set('scope', defaultScope)
      router.replace(`${basePath}?${params.toString()}`, { scroll: false })
    },
    [basePath, defaultScope, isDomesticHub, router]
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
      sp.set('limit', '1000')
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
      }
    },
    [onPatch, q]
  )

  const chips = useMemo(() => buildFilterChips(q), [q])

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
      Boolean(q.regionPref?.trim()) ||
      Boolean(q.type?.trim()),
    [q]
  )

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
              조건에 맞는 상품 {data.total.toLocaleString('ko-KR')}건
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

  const sort: BrowseSort =
    (q.sort as BrowseSort) || (q.budgetPerPerson != null || q.budgetMin != null ? 'budget_fit' : 'popular')

  const toolbar = (
    <div className={suppressHeadingToolbarGap ? 'mt-0' : 'mt-2'}>
      <ProductSortBar
        sort={sort}
        budgetActive={budgetActive}
        onChange={(next) => onPatch({ sort: next, page: 1 })}
      />
    </div>
  )

  const results = (
    <>
      {loading && <p className="mt-10 text-center text-sm text-slate-500">불러오는 중…</p>}
      {error && (
        <p className="mt-10 text-center text-sm text-rose-700" role="alert">
          {error}
        </p>
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
      {!loading && data && data.total === 0 && !budgetActive && !hasNonBudgetFilters && (
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
              href={
                defaultScope === 'overseas' ? '/inquiry?type=travel&source=/travel/overseas' : '/inquiry?type=travel'
              }
              className="font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline"
            >
              상담 신청
            </Link>
            을 이용하실 수 있습니다.
          </p>
        </div>
      )}
      {!loading && data && data.total > 0 && (
        <>
          <ProductResultsList
            items={data.items}
            formatWon={formatWon}
            groupOverseasByRegion={basePath === '/travel/overseas' && defaultScope === 'overseas'}
            groupAirHotelByCountry={pathname === '/travel/air-hotel'}
            groupDomesticByRegion={isDomesticHub}
            overseasEditorialBriefing={overseasEditorialBriefing}
            monthlyCurationMid={monthlyCurationMid}
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
        <span className="text-xs text-slate-500">{data ? `${data.total}건` : ''}</span>
      ) : null}
    </div>
  )

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
          <ProductFilterForm
            q={q}
            facets={facets}
            onPatch={onPatch}
            airlineShowAll={airlineShowAll}
            setAirlineShowAll={setAirlineShowAll}
            travelContext={defaultScope === 'domestic' ? 'domestic' : 'overseas'}
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
          router.replace(`${basePath}?${sp.toString()}`, { scroll: false })
          setDrawerOpen(false)
        }}
      />
    </>
  )
}
