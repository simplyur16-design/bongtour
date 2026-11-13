'use client'

import { useEffect, useState } from 'react'

/**
 * `?departure=YYYY-MM-DD` 딥링크.
 * REGRESSION-FREEZE[product-detail-departure-url-no-searchparams]: next/navigation search hook 금지 — manifest
 *
 * App Router search hook 은 상품 상세 Suspense(fallback null)와 맞물려 본문 리마운트·깜빡임을 유발한다.
 * (해외 허브 `OverseasHubCatalogRoot` 와 동일 — soft-nav 리마운트 루프 방지)
 */
export function parseProductDepartureYmdFromSearch(search: string): string | null {
  const q = search.startsWith('?') ? search.slice(1) : search
  const raw = new URLSearchParams(q).get('departure')?.trim() ?? ''
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

/**
 * 요청 `departure`가 선택되지 않았을 때 주소가 그 날짜를 유지하지 않게 한다.
 * 다른 쿼리와 hash는 그대로 둔다. 선택일이 있으면 그 날짜로 바꾸고, 없으면 departure만 뺀다.
 * 바꿀 것이 없으면 null.
 */
export function alignRejectedDepartureSearch(
  search: string,
  selectedYmd: string | null | undefined,
): string | null {
  const requested = parseProductDepartureYmdFromSearch(search)
  if (!requested) return null
  const selected = String(selectedYmd ?? '').trim()
  const selectedOk = /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : null
  if (selectedOk === requested) return null
  const raw = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(raw)
  if (selectedOk) params.set('departure', selectedOk)
  else params.delete('departure')
  const next = params.toString()
  return next ? `?${next}` : ''
}

export type ProductDepartureUrlRead = {
  /** false면 아직 location을 읽지 않았다. 요청 없음(ymd null)과 구분한다. */
  ready: boolean
  ymd: string | null
}

/**
 * 주소 교정은 읽기가 끝났고, 그 YYYY-MM-DD 요청이 선택 행이 아닐 때만 한다.
 * 초기 null, 요청 없음, 형식 불일치, 유효 행 선택, 사용자 고정은 false.
 */
export function rejectedDepartureMayReplaceLocation(input: {
  ready: boolean
  requestedYmd: string | null
  urlRowSelected: boolean
  userPinned: boolean
}): input is {
  ready: true
  requestedYmd: string
  urlRowSelected: false
  userPinned: false
} {
  return input.ready && !input.userPinned && !input.urlRowSelected && input.requestedYmd != null
}

/** replaceState만 사용한다. 판단한 요청일과 주소의 departure가 같을 때만 바꾼다. */
export function replaceRejectedDepartureInLocation(selectedYmd: string | null, requestedYmd: string): void {
  if (typeof window === 'undefined') return
  if (parseProductDepartureYmdFromSearch(window.location.search) !== requestedYmd) return
  const nextSearch = alignRejectedDepartureSearch(window.location.search, selectedYmd)
  if (nextSearch == null) return
  const next = `${window.location.pathname}${nextSearch}${window.location.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next === current) return
  window.history.replaceState(window.history.state, '', next)
}

export function useProductDepartureUrlRead(): ProductDepartureUrlRead {
  const [read, setRead] = useState<ProductDepartureUrlRead>({ ready: false, ymd: null })

  useEffect(() => {
    const readNow = () =>
      setRead({
        ready: true,
        ymd: parseProductDepartureYmdFromSearch(window.location.search),
      })
    readNow()
    window.addEventListener('popstate', readNow)
    return () => window.removeEventListener('popstate', readNow)
  }, [])

  return read
}

export function useProductDepartureYmdFromUrl(): string | null {
  return useProductDepartureUrlRead().ymd
}
