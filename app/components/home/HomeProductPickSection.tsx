'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import AgentCard from '@/app/components/gallery/AgentCard'
import type { GalleryProduct } from '@/app/api/gallery/route'
import {
  partitionGalleryByTab,
  pickTabLabel,
  productTypeShortLabel,
  triageProductTitleForPickTab,
  type ProductPickTab,
} from '@/lib/gallery-product-triage'
import {
  MAIN_PRODUCT_PICK_EYEBROW,
  MAIN_PRODUCT_PICK_FOOTNOTE,
  MAIN_PRODUCT_PICK_LEAD,
  MAIN_PRODUCT_PICK_TITLE,
} from '@/lib/main-hub-copy'
import type { DomesticPillarId } from '@/lib/domestic-landing-nav-data'
import { domesticScheduleMatchesTerms } from '@/lib/domestic-landing-refine'
import {
  productMatchesDomesticDestinationTerms,
  productThemeTagsMatchTerms,
} from '@/lib/match-domestic-product'
import {
  buildOverseasProductMatchHaystack,
  productMatchesOverseasDestinationTerms,
} from '@/lib/match-overseas-product'
import {
  productMatchesOverseasQuickChipIds,
  supplierKeyFromLandingPick,
  type OverseasLandingSearchState,
} from '@/lib/overseas-landing-search'
import OverseasCompareCard from '@/app/components/travel/overseas/OverseasCompareCard'
import type { OverseasSupplierKey } from '@/lib/normalize-supplier-origin'
import { supplierOriginMatchesKey } from '@/lib/normalize-supplier-origin'
import { productTitleMatchesTerms } from '@/lib/overseas-location-tree'
import type { OverseasBrowseTabId } from '@/app/components/travel/overseas/OverseasSecondaryTabs'

export type ProductPickMarket = 'all' | 'overseas' | 'domestic'

type GalleryResponse = {
  items: GalleryProduct[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const TABS_ALL: { tab: ProductPickTab; hashId: string }[] = [
  { tab: 'domestic', hashId: 'pick-domestic' },
  { tab: 'overseas_package', hashId: 'pick-package' },
  { tab: 'freeform', hashId: 'pick-free' },
]

const TABS_OVERSEAS: { tab: ProductPickTab; hashId: string }[] = [
  { tab: 'overseas_package', hashId: 'pick-os-pkg' },
  { tab: 'freeform', hashId: 'pick-os-free' },
]

const TABS_DOMESTIC: { tab: ProductPickTab; hashId: string }[] = [{ tab: 'domestic', hashId: 'pick-dm' }]

function tabsForMarket(market: ProductPickMarket) {
  switch (market) {
    case 'overseas':
      return TABS_OVERSEAS
    case 'domestic':
      return TABS_DOMESTIC
    default:
      return TABS_ALL
  }
}

function defaultTab(market: ProductPickMarket): ProductPickTab {
  if (market === 'overseas') return 'overseas_package'
  return 'domestic'
}

function hashToTab(hash: string, tabs: { tab: ProductPickTab; hashId: string }[]): ProductPickTab | null {
  const h = hash.replace(/^#/, '')
  const row = tabs.find((t) => t.hashId === h)
  return row?.tab ?? null
}

const MAX_CARDS = 6

function productMatchesOverseasFreeText(p: GalleryProduct, q: string): boolean {
  const tokens = q
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0) return true
  const haystack = buildOverseasProductMatchHaystack(p)
  return tokens.every((t) => haystack.includes(t))
}

function refineOverseasGalleryRows(
  rows: GalleryProduct[],
  search: OverseasLandingSearchState | null | undefined
): GalleryProduct[] {
  if (!search) return rows
  let next = rows
  if (search.q.trim()) {
    next = next.filter((p) => productMatchesOverseasFreeText(p, search.q))
  }
  if (search.departDate) {
    next = next.filter((p) => p.departureDate?.slice(0, 10) === search.departDate)
  }
  if (search.departFrom.trim()) {
    const f = search.departFrom.trim().toLowerCase()
    next = next.filter((p) => buildOverseasProductMatchHaystack(p).includes(f))
  }
  const min = parseInt(search.priceMin, 10)
  const max = parseInt(search.priceMax, 10)
  if (!Number.isNaN(min) && min > 0) {
    next = next.filter((p) => p.priceKrw != null && p.priceKrw >= min)
  }
  if (!Number.isNaN(max) && max > 0) {
    next = next.filter((p) => p.priceKrw != null && p.priceKrw <= max)
  }
  return next
}

function sortOverseasGalleryRows(rows: GalleryProduct[], sort: OverseasLandingSearchState['sort']): GalleryProduct[] {
  const copy = [...rows]
  if (sort === 'price_asc') {
    copy.sort((a, b) => (a.priceKrw ?? 2e9) - (b.priceKrw ?? 2e9))
  } else if (sort === 'price_desc') {
    copy.sort((a, b) => (b.priceKrw ?? -1) - (a.priceKrw ?? -1))
  } else if (sort === 'date_asc') {
    copy.sort((a, b) => String(a.departureDate ?? '').localeCompare(String(b.departureDate ?? '')))
  }
  return copy
}

type Props = {
  market?: ProductPickMarket
  sectionId?: string
  eyebrow?: string
  title?: string
  lead?: string
  footnote?: string | null
  /** 해외 랜딩: 국가·도시 탐색에서 넘긴 키워드로 상품명 필터 (빈 배열이면 필터 없음) */
  destinationFilterTerms?: string[]
  /** `/travel/overseas` 등에서 탭 ↔ URL 해시 동기화 (`#pick-os-pkg` / `#pick-os-free`) */
  enableOverseasTabHashSync?: boolean
  /**
   * 공급사 탭 — `originSource` 를 정규화한 키로 필터. 설정 시 `supplierOriginIncludes` 보다 우선.
   * (미설정이면 공급사 키 필터 없음)
   */
  supplierFilterKey?: OverseasSupplierKey
  /** 레거시: substring 매칭. 메인 등에서만 사용 권장 */
  supplierOriginIncludes?: string[]
  /** 해외 랜딩 탭 — empty state 문구 분기 */
  overseasBrowseTab?: OverseasBrowseTabId
  /** 국내 랜딩: 테마 칩 → 제목·목적지 haystack 매칭 (지역별과 AND) */
  themeFilterTerms?: string[]
  /** 국내 랜딩 1차 축 — empty state 문구 분기 */
  domesticBrowsePillar?: DomesticPillarId
  /** 국내: 좌측 정교 필터·특별기획 보조 */
  domesticRowFilter?: (p: GalleryProduct) => boolean
  /** 국내: 일정 축(박·주말 등) 엄밀 매칭 AND */
  domesticScheduleStrictTerms?: string[]
  /** 국내: 상품 목록 옆 정렬 필터 패널 */
  aside?: ReactNode
  /** 해외 랜딩 상단 검색 패널 상태 */
  overseasLandingSearch?: OverseasLandingSearchState | null
  /** 해외 랜딩: 여행사형 비교 카드·2열 레이아웃 */
  overseasCompareLayout?: boolean
  /** 갤러리 API limit (기본 24) */
  galleryFetchLimit?: number
  /** 결과 최대 개수 (기본 6, 해외 비교 시 12 권장) */
  maxResultCards?: number
}

export default function HomeProductPickSection({
  market = 'all',
  sectionId = 'consult-products',
  eyebrow = MAIN_PRODUCT_PICK_EYEBROW,
  title = MAIN_PRODUCT_PICK_TITLE,
  lead = MAIN_PRODUCT_PICK_LEAD,
  footnote = MAIN_PRODUCT_PICK_FOOTNOTE,
  destinationFilterTerms = [],
  enableOverseasTabHashSync = false,
  supplierFilterKey,
  supplierOriginIncludes = [],
  overseasBrowseTab,
  themeFilterTerms = [],
  domesticBrowsePillar,
  domesticRowFilter,
  domesticScheduleStrictTerms = [],
  aside,
  overseasLandingSearch = null,
  overseasCompareLayout = false,
  galleryFetchLimit = 24,
  maxResultCards,
}: Props) {
  const tabs = useMemo(() => tabsForMarket(market), [market])
  const [items, setItems] = useState<GalleryProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<ProductPickTab>(() => defaultTab(market))

  const applyHash = useCallback(() => {
    if (market !== 'all' || typeof window === 'undefined') return
    const t = hashToTab(window.location.hash, tabs)
    if (t) setActive(t)
  }, [market, tabs])

  useEffect(() => {
    setActive(defaultTab(market))
  }, [market])

  useEffect(() => {
    if (market !== 'all') return
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [market, applyHash])

  const applyOverseasHash = useCallback(() => {
    if (market !== 'overseas' || !enableOverseasTabHashSync || typeof window === 'undefined') return
    const t = hashToTab(window.location.hash, tabs)
    if (t) setActive(t)
  }, [market, enableOverseasTabHashSync, tabs])

  useEffect(() => {
    if (market !== 'overseas' || !enableOverseasTabHashSync) return
    applyOverseasHash()
    window.addEventListener('hashchange', applyOverseasHash)
    return () => window.removeEventListener('hashchange', applyOverseasHash)
  }, [market, enableOverseasTabHashSync, applyOverseasHash])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const lim = Math.min(48, Math.max(6, galleryFetchLimit))
        const res = await fetch(`/api/gallery?page=1&limit=${lim}`)
        if (!res.ok) throw new Error('fetch failed')
        const json: GalleryResponse = await res.json()
        if (!cancelled) setItems(json.items ?? [])
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [galleryFetchLimit])

  const effSupplierFilterKey = useMemo((): OverseasSupplierKey | undefined => {
    if (market !== 'overseas' || !overseasLandingSearch) return supplierFilterKey
    const pick = overseasLandingSearch.supplierPick
    if (pick != null && pick !== 'all') {
      return supplierKeyFromLandingPick(pick)
    }
    return supplierFilterKey
  }, [market, overseasLandingSearch, supplierFilterKey])

  useEffect(() => {
    if (market !== 'overseas' || !overseasLandingSearch) return
    const tt = overseasLandingSearch.travelType
    if (tt === 'package') setActive('overseas_package')
    else if (tt === 'free') setActive('freeform')
  }, [market, overseasLandingSearch?.travelType])

  const partitioned = useMemo(() => partitionGalleryByTab(items), [items])
  const filteredPartitioned = useMemo(() => {
    const keys: ProductPickTab[] = ['domestic', 'overseas_package', 'freeform']
    let next = { ...partitioned }
    if (effSupplierFilterKey !== undefined) {
      const bySupplierKey = (p: GalleryProduct) => supplierOriginMatchesKey(p.originSource, effSupplierFilterKey)
      for (const k of keys) {
        next[k] = next[k].filter(bySupplierKey)
      }
    } else if (supplierOriginIncludes.length > 0) {
      const subs = supplierOriginIncludes.map((s) => s.toLowerCase())
      const bySupplier = (p: GalleryProduct) =>
        subs.some((sub) => p.originSource.toLowerCase().includes(sub))
      for (const k of keys) {
        next[k] = next[k].filter(bySupplier)
      }
    }
    const destOrTheme =
      destinationFilterTerms.length > 0 ||
      (market === 'overseas' &&
        overseasLandingSearch &&
        overseasLandingSearch.quickIds.length > 0) ||
      (market === 'domestic' && themeFilterTerms.length > 0)

    if (destOrTheme) {
      for (const k of keys) {
        next[k] = next[k].filter((p) => {
          if (market === 'overseas') {
            const destOk =
              destinationFilterTerms.length === 0 ||
              productMatchesOverseasDestinationTerms(p, destinationFilterTerms)
            const quickOk =
              !overseasLandingSearch ||
              productMatchesOverseasQuickChipIds(p, overseasLandingSearch.quickIds)
            return destOk && quickOk
          }
          if (market === 'domestic') {
            const destOk =
              destinationFilterTerms.length === 0 ||
              productMatchesDomesticDestinationTerms(p, destinationFilterTerms)
            const themeOk =
              themeFilterTerms.length === 0 ||
              productMatchesDomesticDestinationTerms(p, themeFilterTerms) ||
              productThemeTagsMatchTerms(p.themeTags, themeFilterTerms)
            return destOk && themeOk
          }
          return productTitleMatchesTerms(p.title, destinationFilterTerms)
        })
      }
    }
    if (
      market === 'domestic' &&
      (domesticRowFilter != null || (domesticScheduleStrictTerms?.length ?? 0) > 0)
    ) {
      const strict = domesticScheduleStrictTerms ?? []
      for (const k of keys) {
        next[k] = next[k].filter((p) => {
          if (domesticRowFilter && !domesticRowFilter(p)) return false
          if (strict.length > 0 && !domesticScheduleMatchesTerms(p, strict)) return false
          return true
        })
      }
    }
    return next
  }, [
    partitioned,
    destinationFilterTerms,
    themeFilterTerms,
    supplierOriginIncludes,
    effSupplierFilterKey,
    market,
    overseasLandingSearch,
    domesticRowFilter,
    domesticScheduleStrictTerms,
  ])

  const sliceCap = maxResultCards ?? MAX_CARDS

  const sortedFull = useMemo(() => {
    const base = filteredPartitioned[active]
    if (market !== 'overseas' || !overseasLandingSearch) return base
    const refined = refineOverseasGalleryRows(base, overseasLandingSearch)
    return sortOverseasGalleryRows(refined, overseasLandingSearch.sort)
  }, [filteredPartitioned, active, market, overseasLandingSearch])

  const list =
    market === 'overseas' && overseasLandingSearch
      ? sortedFull.slice(0, sliceCap)
      : filteredPartitioned[active].slice(0, sliceCap)

  const totalMatchCount =
    market === 'overseas' && overseasLandingSearch ? sortedFull.length : filteredPartitioned[active].length

  const tabCountFor = useCallback(
    (tab: ProductPickTab) => {
      if (market === 'overseas' && overseasLandingSearch) {
        const refined = refineOverseasGalleryRows(filteredPartitioned[tab], overseasLandingSearch)
        return sortOverseasGalleryRows(refined, overseasLandingSearch.sort).length
      }
      return filteredPartitioned[tab].length
    },
    [filteredPartitioned, market, overseasLandingSearch]
  )
  const showTabs = tabs.length > 1
  const activeHashId = tabs.find((t) => t.tab === active)?.hashId

  const supplierFilterActive = effSupplierFilterKey !== undefined
  const hasDestinationFilter = destinationFilterTerms.length > 0
  const hasOverseasQuick = (overseasLandingSearch?.quickIds?.length ?? 0) > 0
  const hasOverseasRefine =
    Boolean(overseasLandingSearch?.q?.trim()) ||
    Boolean(overseasLandingSearch?.departDate) ||
    Boolean(overseasLandingSearch?.departFrom?.trim()) ||
    Boolean(overseasLandingSearch?.priceMin) ||
    Boolean(overseasLandingSearch?.priceMax) ||
    (overseasLandingSearch?.sort != null && overseasLandingSearch.sort !== 'default')
  const marketFootnote =
    market === 'overseas'
      ? '목적지 매칭: 대표 목적지 → 목적지 원문 → 레거시 목적지 → 상품명 → 출처 문자열 순으로 토큰을 합쳐 비교합니다. 유형(패키지/자유)은 제목 휴리스틱입니다.'
      : market === 'domestic'
        ? '국내 매칭: 지역·일정은 상품명·권역 메타를 우선합니다. 버스·기차·선박(크루즈)는 상단 메뉴·교통 필터로 좁힙니다. 특별테마는 displayCategory에 「국내특별테마」가 있을 때만 해당 메뉴에 노출됩니다.'
        : footnote

  const emptyMessage =
    market === 'domestic' && !loading && list.length === 0
      ? (() => {
          const pillar = domesticBrowsePillar ?? 'region'
          const hasTheme = themeFilterTerms.length > 0
          if (hasDestinationFilter && hasTheme && supplierFilterActive) {
            return '지역·테마·공급사 조건을 동시에 만족하는 일정이 없습니다. 좌측 필터를 넓히거나 지역 트리에서 상위 권역을 선택해 보세요.'
          }
          if (hasDestinationFilter && hasTheme) {
            return '선택한 지역과 테마 키워드를 함께 만족하는 일정이 없습니다. 좌측 필터를 완화하거나 지역을 넓혀 보세요.'
          }
          if (supplierFilterActive) {
            return '선택한 공급사로 노출 가능한 국내 일정이 없습니다. 전체 공급사 또는 지역별 탐색을 병행해 주세요.'
          }
          if (hasTheme) {
            if (!hasDestinationFilter) {
              return '테마·일정 축만 적용된 상태입니다. 상단 「지역별」 또는 왼쪽 지역에서 목적지를 함께 고르면 더 정확합니다.'
            }
            return '선택한 테마 키워드에 맞는 국내 일정이 없습니다. 다른 테마를 고르거나 좌측 필터를 조정해 보세요.'
          }
          if (hasDestinationFilter) {
            return '선택한 지역·목적지에 맞는 일정을 찾지 못했습니다. 권역 전체·지역 전체를 눌러 범위를 넓히거나 상담으로 알려 주세요.'
          }
          if (pillar === 'special_theme') {
            return '특별테마(displayCategory) 표기가 있는 일정이 없습니다. 운영에서 라벨을 붙인 뒤 다시 확인해 주세요.'
          }
          if (pillar === 'bus' || pillar === 'train' || pillar === 'ship' || pillar === 'schedule') {
            return '선택한 분류에 맞는 일정이 없습니다. 지역 트리에서 권역을 함께 지정하거나 좌측 필터를 조정해 보세요.'
          }
          return '노출 가능한 국내 일정이 아직 없습니다. 상단 분류·지역 탐색·월별 추천·상담 신청으로 동선을 잡아 주세요.'
        })()
      : market === 'overseas' && !loading && list.length === 0
        ? (() => {
          const tab = overseasBrowseTab ?? 'countries'
          if (hasDestinationFilter && supplierFilterActive) {
            return '선택한 목적지와 출처(공급사)를 동시에 만족하는 일정이 이 탭에 없습니다. 공급사 칩을 「전체」로 넓히거나, 나라별 탭에서 인접 도시·상위 권역을 선택해 보세요. 원하시는 조합은 상담으로 요청해 주시면 공급사 일정을 함께 찾습니다.'
          }
          if (supplierFilterActive) {
            return '현재 선택한 출처로 노출 가능한 일정이 이 유형 탭에 없습니다. 「기타」·「전체 공급사」로 넓히거나 나라별 탐색을 병행해 주세요. 상담 시 다른 여행사 일정도 함께 확인할 수 있습니다.'
          }
          if (hasOverseasRefine || hasOverseasQuick) {
            return '상단 검색·빠른 키워드·가격 조건을 함께 만족하는 일정이 없습니다. 출발일·가격대를 넓히거나 검색어를 줄여 보세요. 목적지는 나라별 빠른 탐색으로 바꿔도 됩니다.'
          }
          if (hasDestinationFilter) {
            return '선택한 목적지에 맞는 일정을 아직 이 탭에서 찾지 못했습니다. 상위에서 「국가 전체」·「권역 전체」를 눌러 범위를 넓히거나, 패키지/자유여행 탭을 바꿔 보세요. 대표 목적지·원문 필드가 비어 있는 상품은 제목만으로 매칭됩니다.'
          }
          if (tab === 'free' && active === 'freeform') {
            return '자유여행·에어텔·항공+호텔 성격 일정은 순차적으로 정리 중입니다. 「패키지 여행」 탭도 함께 보시고, 희망 목적지는 나라별 탐색 후 상담으로 알려 주시면 견적·일정을 맞춥니다.'
          }
          if (tab === 'curation') {
            return '이 유형 탭에 맞는 상담 가능 일정이 없습니다. 위쪽 「이번 달 추천 해외여행」 큐레이션과 나라별 탐색을 함께 보시거나, 상담으로 희망 일정을 남겨 주세요.'
          }
          if (tab === 'supplier') {
            return '선택한 출처 조건과 유형 탭 조합에 맞는 일정이 없습니다. 다른 유형 탭을 눌러 보시거나 「전체 공급사」로 넓혀 주세요.'
          }
          return '이 유형에 맞는 노출 일정이 아직 없습니다. 나라별 탭에서 목적지를 고른 뒤 다시 확인하시거나, 상담으로 희망 지역·일정을 알려 주시면 공급사 데이터를 함께 찾아 드립니다.'
        })()
        : null

  return (
    <section
      id={sectionId}
      className="scroll-mt-24 border-t border-bt-border bg-bt-page py-14 sm:py-16"
      aria-labelledby={`${sectionId}-heading`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {eyebrow ? <p className="bt-section-kicker">{eyebrow}</p> : null}
        <h2 id={`${sectionId}-heading`} className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl">
          {title}
        </h2>
        {lead ? <p className="bt-wrap mt-3 max-w-3xl text-sm leading-relaxed text-bt-muted">{lead}</p> : null}

        {showTabs ? (
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3" role="tablist" aria-label="상품 유형">
            {tabs.map(({ tab, hashId }) => {
              const selected = active === tab
              const count = tabCountFor(tab)
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={hashId}
                  aria-selected={selected}
                  onClick={() => {
                    setActive(tab)
                    if (typeof window === 'undefined') return
                    const useHash =
                      market === 'all' || (market === 'overseas' && enableOverseasTabHashSync)
                    if (useHash && window.location.hash !== `#${hashId}`) {
                      window.history.replaceState(null, '', `#${hashId}`)
                    }
                  }}
                  className={`rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition sm:text-center ${
                    selected
                      ? 'border-bt-accent/50 bg-bt-accent-subtle text-bt-ink shadow-sm'
                      : 'border-bt-border bg-bt-surface text-bt-muted hover:border-bt-accent/30 hover:text-bt-ink'
                  }`}
                >
                  {pickTabLabel(tab)}
                  <span className="mt-0.5 block text-[11px] font-normal text-bt-subtle">{count}건 후보</span>
                </button>
              )
            })}
          </div>
        ) : market === 'domestic' ? null : (
          <p className="mt-6 text-sm font-medium text-bt-ink">{pickTabLabel(active)} 일정</p>
        )}

        {marketFootnote ? <p className="mt-4 text-xs text-bt-subtle">{marketFootnote}</p> : null}

        {market === 'overseas' && overseasCompareLayout && !loading ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bt-border/80 bg-bt-surface px-4 py-3 text-sm">
            <p className="font-medium text-bt-ink">
              검색 결과{' '}
              <span className="text-bt-accent">{totalMatchCount}</span>
              건
              {totalMatchCount > list.length ? (
                <span className="ml-1 text-xs font-normal text-bt-muted">(표시 {list.length}건까지)</span>
              ) : null}
            </p>
            {overseasLandingSearch && overseasLandingSearch.sort !== 'default' ? (
              <span className="text-xs text-bt-subtle">
                정렬:{' '}
                {overseasLandingSearch.sort === 'price_asc'
                  ? '가격 낮은 순'
                  : overseasLandingSearch.sort === 'price_desc'
                    ? '가격 높은 순'
                    : '출발일 빠른 순'}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={aside ? 'mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]' : 'mt-10'}
        >
          {aside ? <div className="min-w-0 lg:pt-1">{aside}</div> : null}
          <div role="tabpanel" aria-labelledby={activeHashId} className="min-w-0">
            {loading ? (
              <div
                className={
                  overseasCompareLayout
                    ? 'grid grid-cols-1 gap-4 lg:grid-cols-2'
                    : 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'
                }
              >
                {Array.from({ length: overseasCompareLayout ? 4 : 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={`animate-pulse rounded-2xl bg-bt-border/40 ${overseasCompareLayout ? 'h-48' : 'h-64'}`}
                  />
                ))}
              </div>
            ) : list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-bt-border bg-bt-surface px-5 py-10 text-center text-sm leading-relaxed text-bt-muted">
                {emptyMessage ??
                  (supplierOriginIncludes.length > 0 && destinationFilterTerms.length > 0
                    ? '선택한 공급사·목적지 조건에 맞는 상품이 없습니다. 필터를 넓히거나 상담으로 문의해 주세요.'
                    : supplierOriginIncludes.length > 0
                      ? '선택한 공급사에 해당하는 상품이 이 탭에 없습니다. 다른 공급사를 고르거나 상담으로 문의해 주세요.'
                      : destinationFilterTerms.length > 0
                        ? '선택한 목적지 키워드에 맞는 상품이 이 유형 탭에서 보이지 않습니다. 다른 도시·국가를 고르거나 탭을 바꿔 보세요. 원하시는 일정은 상담으로 말씀해 주시면 공급사 일정을 함께 찾습니다.'
                        : '이 유형에 맞는 노출 상품이 아직 없습니다. 상담 시 원하시는 일정을 말씀해 주시면 공급사 일정을 함께 찾아 드립니다.')}
              </p>
            ) : (
              <div
                className={
                  overseasCompareLayout
                    ? 'grid grid-cols-1 gap-4 lg:grid-cols-2'
                    : 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'
                }
              >
                {list.map((product, i) =>
                  overseasCompareLayout ? (
                    <OverseasCompareCard
                      key={product.id}
                      product={product}
                      priority={i === 0}
                      productTypeLabel={productTypeShortLabel(triageProductTitleForPickTab(product.title))}
                    />
                  ) : (
                    <AgentCard
                      key={product.id}
                      product={product}
                      priority={i === 0}
                      pickStyle
                      typeBadge={productTypeShortLabel(triageProductTitleForPickTab(product.title))}
                    />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
