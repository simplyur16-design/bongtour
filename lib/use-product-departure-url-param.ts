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

export function useProductDepartureYmdFromUrl(): string | null {
  const [ymd, setYmd] = useState<string | null>(null)

  useEffect(() => {
    const read = () => setYmd(parseProductDepartureYmdFromSearch(window.location.search))
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [])

  return ymd
}
