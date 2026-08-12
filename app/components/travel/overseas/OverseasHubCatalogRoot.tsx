'use client'

import OverseasHubCatalogGallery from '@/app/components/travel/overseas/OverseasHubCatalogGallery'
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
 * - 중·하(menuGroup/city/country): 서버 geo WHERE fetch (전량 스캔 병목 제거)
 * REGRESSION-FREEZE[overseas-hub-server-geo-fetch]: root wires server geo fetch — manifest
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

    if (!needsServerGeo) {
      const peek = peekOverseasHubCatalogItems()
      if (peek.length > 0) {
        setCatalogItems(peek)
        setCatalogLoading(false)
        setError(null)
        return
      }

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
    void fetchProductsBrowseClientJson(queryKey)
      .then((json) => {
        if (cancelled || gen !== geoFetchGenRef.current) return
        const items = (json.items ?? []) as ResultItem[]
        setCatalogItems(items)
        setCatalogLoading(false)
        setError(null)
      })
      .catch((e) => {
        if (cancelled || gen !== geoFetchGenRef.current) return
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
      // REGRESSION-FREEZE[overseas-hub-server-geo-fetch]: server geo items skip client re-filter — manifest
      // 서버가 이미 ProductCountryTag/ProductCityTag WHERE로 좁힌 목록을 클라이언트 menuGroup이 다시 비우면
      // 「선택한 조건에 맞는 상품이 없습니다」가 난다.
      const filtered = overseasHubUrlNeedsServerGeoFetch(sp)
        ? catalogItems
        : filterOverseasHubCatalogByUrl(catalogItems, sp)
      const built = buildOverseasHubCatalogSectionsForUrl(filtered, sp)
      sectionsCacheRef.current.set(cacheKey, built)
      setSections(built)
      setSectionsBusy(false)
    }

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 80 })
      return () => {
        cancelled = true
        cancelIdleCallback(id)
      }
    }

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
