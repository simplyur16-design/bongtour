'use client'

import OverseasHubCatalogGallery from '@/app/components/travel/overseas/OverseasHubCatalogGallery'
import OverseasHubTravelTypeChips from '@/app/components/travel/overseas/OverseasHubTravelTypeChips'
import type { ResultItem } from '@/components/products/ProductResultsList'
import { filterOverseasHubCatalogByUrl } from '@/lib/overseas-hub-client-catalog-filter'
import {
  buildOverseasHubCatalogSectionsForUrl,
  type OverseasHubCatalogSection,
} from '@/lib/overseas-hub-catalog-sections'
import {
  EMPTY_OVERSEAS_HUB_CATALOG,
  ensureOverseasHubCatalog,
  peekOverseasHubCatalogItems,
} from '@/lib/overseas-hub-catalog-client'
import {
  getOverseasHubSearchParamsString,
  subscribeOverseasHubUrl,
} from '@/lib/overseas-hub-client-nav'
import { fetchProductsBrowseClientJson } from '@/lib/products-browse-client-fetch'
import {
  buildOverseasHubBrowseQueryKey,
  overseasHubUrlNeedsServerGeoFetch,
} from '@/lib/products-browse-hub-query'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

type Props = {
  /** RSC가 매 soft-nav마다 갱신 — `useSearchParams` 미사용(허브 무한 리마운트 방지) */
  initialSearchParamsString: string
  hubGalleryRotationSeed: number
}

/**
 * 해외 허브 상품 목록 —
 * - 상위탭(region-only): 전량 카탈로그 1회 + 클라이언트 필터
 * - 중·하: 워밍 카탈로그 있으면 즉시 클라이언트 필터 (메가메뉴 클릭 지연 제거)
 * - 중·하 cold(카탈로그 없음): 서버 geo WHERE fetch
 * REGRESSION-FREEZE[overseas-hub-server-geo-fetch]: root wires server geo fetch — manifest
 * REGRESSION-FREEZE[overseas-hub-mega-warm-catalog-instant]: warm mid/leaf no server wait — manifest
 */
export default function OverseasHubCatalogRoot({
  initialSearchParamsString,
  hubGalleryRotationSeed,
}: Props) {
  const serverSearchParamsRef = useRef(initialSearchParamsString)
  const searchParamsString = useSyncExternalStore(
    subscribeOverseasHubUrl,
    getOverseasHubSearchParamsString,
    () => serverSearchParamsRef.current,
  )
  const [catalogItems, setCatalogItems] = useState<ResultItem[]>(EMPTY_OVERSEAS_HUB_CATALOG)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [sections, setSections] = useState<OverseasHubCatalogSection[]>([])
  const [sectionsBusy, setSectionsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rotationSeedRef = useRef(hubGalleryRotationSeed)
  const sectionsCacheRef = useRef(new Map<string, OverseasHubCatalogSection[]>())
  const geoFetchGenRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const sp = new URLSearchParams(searchParamsString)
    const needsServerGeo = overseasHubUrlNeedsServerGeoFetch(sp)

    // REGRESSION-FREEZE[overseas-hub-mega-warm-catalog-instant]: peek 있으면 mid/leaf도 즉시 — manifest
    const peek = peekOverseasHubCatalogItems()
    if (peek.length > 0) {
      setCatalogItems(peek)
      setCatalogLoading(false)
      setError(null)
      // cold 대비: 백그라운드로 전량 카탈로그도 최신 유지
      void ensureOverseasHubCatalog().catch(() => {})
      return () => {
        cancelled = true
      }
    }

    if (!needsServerGeo) {
      setCatalogLoading(true)
      void ensureOverseasHubCatalog()
        .then((items) => {
          if (cancelled) return
          setCatalogItems(items)
          setCatalogLoading(false)
          setError(null)
        })
        .catch((e) => {
          if (cancelled) return
          setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
          setCatalogLoading(false)
        })

      return () => {
        cancelled = true
      }
    }

    const gen = ++geoFetchGenRef.current
    setCatalogLoading(true)
    const queryKey = buildOverseasHubBrowseQueryKey(sp)
    // cold mid/leaf — 서버 geo + 전량 카탈로그 병행 (다음 클릭은 warm)
    void ensureOverseasHubCatalog().catch(() => {})
    void fetchProductsBrowseClientJson(queryKey)
      .then((json) => {
        if (cancelled || gen !== geoFetchGenRef.current) return
        // warm이 중간에 채워졌으면 서버 결과로 덮지 않음 (이미 즉시 경로)
        const warm = peekOverseasHubCatalogItems()
        if (warm.length > 0) {
          setCatalogItems(warm)
          setCatalogLoading(false)
          setError(null)
          return
        }
        const items = (json.items ?? []) as ResultItem[]
        setCatalogItems(items)
        setCatalogLoading(false)
        setError(null)
      })
      .catch((e) => {
        if (cancelled || gen !== geoFetchGenRef.current) return
        const warm = peekOverseasHubCatalogItems()
        if (warm.length > 0) {
          setCatalogItems(warm)
          setCatalogLoading(false)
          setError(null)
          return
        }
        setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
        setCatalogLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [searchParamsString])

  useEffect(() => {
    sectionsCacheRef.current.clear()
  }, [catalogItems])

  useEffect(() => {
    if (catalogItems.length === 0) {
      setSections([])
      setSectionsBusy(false)
      return
    }

    const cacheKey = searchParamsString
    const cached = sectionsCacheRef.current.get(cacheKey)
    if (cached) {
      setSections(cached)
      setSectionsBusy(false)
      return
    }

    let cancelled = false
    setSectionsBusy(true)

    const run = () => {
      if (cancelled) return
      const sp = new URLSearchParams(searchParamsString)
      // REGRESSION-FREEZE[overseas-hub-mega-warm-catalog-instant]: 항상 URL 클라이언트 필터 — manifest
      // (서버 geo 결과도 동일 URL 필터로 재적용 — 과다 노출 방지)
      const filtered = filterOverseasHubCatalogByUrl(catalogItems, sp)
      const built = buildOverseasHubCatalogSectionsForUrl(filtered, sp)
      sectionsCacheRef.current.set(cacheKey, built)
      setSections(built)
      setSectionsBusy(false)
    }

    // 메가메뉴 클릭 체감 지연: idle 대기 제거 — 즉시 필터
    const t = setTimeout(run, 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [catalogItems, searchParamsString])

  const emptyMessage =
    error != null
      ? error
      : catalogItems.length === 0
        ? overseasHubUrlNeedsServerGeoFetch(searchParamsString)
          ? '선택한 조건에 맞는 상품이 없습니다.'
          : '목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.'
        : sections.length === 0
          ? '선택한 조건에 맞는 상품이 없습니다.'
          : '등록된 여행상품이 없습니다.'

  return (
    <div className={`${SITE_CONTENT_CLASS} pt-3 pb-6 sm:pt-4`}>
      {catalogLoading ? (
        <p className="mt-10 text-center text-sm text-slate-500">불러오는 중…</p>
      ) : null}
      {error ? (
        <div className="mx-auto mt-10 max-w-lg px-4 text-center text-sm text-rose-800" role="alert">
          <p className="font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg border border-rose-300 bg-white px-4 py-2 font-semibold"
          >
            새로고침
          </button>
        </div>
      ) : null}
      {!catalogLoading && !error ? (
        <>
          {sectionsBusy && sections.length === 0 ? (
            <p className="mt-10 text-center text-sm text-slate-500">불러오는 중…</p>
          ) : null}
          <OverseasHubTravelTypeChips />
          <OverseasHubCatalogGallery
            sections={sections}
            rotationSeed={rotationSeedRef.current}
            emptyMessage={emptyMessage}
          />
        </>
      ) : null}
    </div>
  )
}
