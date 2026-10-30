'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  airlineOptionForParam,
  filterPatchRowsByAirline,
  filterPriceRowsByAirline,
  type AirlineDepartureOption,
  type ProductAirlineFilterData,
} from '@/lib/airline-variant-group'
import type { ProductPriceRow } from '@/app/components/travel/travel-product-detail-types'

/**
 * 상품 상세 항공사 필터 — `?airline=` 또는 패널 선택 → 메인 달력·가격·선택 출발행이 그 항공사 예약가능 회차만.
 * 캐시된 상세 모델은 그대로 두고 클라이언트에서 가격행만 바꾼다(JSON-LD/og 는 서버 원본).
 * 파라미터 없음 / 데이터 없음 / 이 상품에 없는 항공사 → 항등(기존 동작 그대로).
 *
 * REGRESSION-FREEZE[airline-variant-group]: 상세 달력 항공사 필터 — manifest
 */
type Ctx = {
  data: ProductAirlineFilterData | null
  selected: AirlineDepartureOption | null
  select: (label: string | null) => void
}

const ProductAirlineFilterContext = createContext<Ctx>({
  data: null,
  selected: null,
  select: () => {},
})

export function ProductAirlineFilterProvider({
  data,
  children,
}: {
  data: ProductAirlineFilterData | null
  children: ReactNode
}) {
  // pages/ 디렉터리가 있어 next build 호환 타입에서 useSearchParams/usePathname 은 null 가능 — 저장소 관례대로 기본값
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const urlOption = airlineOptionForParam(data, searchParams.get('airline'))
  const urlLabel = urlOption?.label ?? null
  /** undefined = URL 따름 · { label } = 방금 고른 값(라우터 반영 전 즉시 적용) */
  const [picked, setPicked] = useState<{ label: string | null } | undefined>(undefined)
  useEffect(() => {
    setPicked(undefined)
  }, [urlLabel])
  const selected = useMemo(() => {
    if (!data) return null
    if (picked === undefined) return urlOption
    return picked.label ? (data.options.find((o) => o.label === picked.label) ?? null) : null
  }, [data, picked, urlOption])

  const select = useCallback(
    (label: string | null) => {
      if (!data) return
      const opt = label ? (data.options.find((o) => o.label === label) ?? null) : null
      setPicked({ label: opt ? opt.label : null })
      const sp = new URLSearchParams(searchParams.toString())
      if (opt) sp.set('airline', opt.param)
      else sp.delete('airline')
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [data, searchParams, router, pathname],
  )

  const value = useMemo(() => ({ data, selected, select }), [data, selected, select])
  return <ProductAirlineFilterContext.Provider value={value}>{children}</ProductAirlineFilterContext.Provider>
}

export function useProductAirlineFilter(): Ctx {
  return useContext(ProductAirlineFilterContext)
}

/** 현장 수집(on-demand) 패치 행 — 필터 중엔 그 항공사 회차 id 만 통과. 필터 없으면 원본 그대로 */
export function useAirlinePatchRowFilter(): <T extends { id: string | number }>(rows: readonly T[]) => T[] {
  const { selected } = useProductAirlineFilter()
  return useCallback(
    <T extends { id: string | number }>(rows: readonly T[]) => filterPatchRowsByAirline(rows, selected),
    [selected],
  )
}

/**
 * 상세 product 의 `prices` 를 선택 항공사 회차(전 예약가능 날짜, 날짜당 최저가 1행)로 바꾼 사본.
 * 필터 없으면 같은 객체(참조) 반환 → 기존 동작 그대로.
 */
export function useAirlineFilteredProduct<P extends { id: string | number; prices: ProductPriceRow[] }>(
  product: P,
): P {
  const { selected } = useProductAirlineFilter()
  return useMemo(() => {
    if (!selected) return product
    const base = Array.isArray(product.prices) ? product.prices : []
    return { ...product, prices: filterPriceRowsByAirline(base, selected, String(product.id)) }
  }, [product, selected])
}

/** 상세 상단·하단 항공사/편명 정합 — 선택 항공사(label·param), 필터 없으면 null */
export function useSelectedAirlineFilter(): { label: string; param: string } | null {
  const { selected } = useProductAirlineFilter()
  return useMemo(() => (selected ? { label: selected.label, param: selected.param } : null), [selected])
}
