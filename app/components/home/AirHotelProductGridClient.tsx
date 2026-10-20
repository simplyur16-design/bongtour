'use client'

import { useEffect, useState } from 'react'
import ProductResultCardsClient from '@/app/components/home/ProductResultCardsClient'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { HUB_BROWSE_CLIENT_FETCH_TIMEOUT_MS } from '@/lib/products-browse-hub-prefetch-timeout'
import { buildHomeAirHotelPreviewBrowseQueryKey } from '@/lib/products-browse-hub-query'
import type { ResultItem } from '@/components/products/ProductResultsList'

type BrowseOk = { ok: true; items: ResultItem[] }

export default function AirHotelProductGridClient({ oceanWarm = false }: { oceanWarm?: boolean }) {
  const [items, setItems] = useState<ResultItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    // REGRESSION-FREEZE[browse-preview-db-take]: canonical home preview key — manifest
    const qs = buildHomeAirHotelPreviewBrowseQueryKey()
    const timer = setTimeout(() => {
      if (active) setReady(true)
    }, HUB_BROWSE_CLIENT_FETCH_TIMEOUT_MS)

    void fetch(`/api/products/browse?${qs}`)
      .then((res) => res.json() as Promise<BrowseOk | { ok: false }>)
      .then((body) => {
        if (!active) return
        if (body.ok && Array.isArray(body.items)) setItems(body.items)
      })
      .catch(() => {
        /* 메인은 browse 실패 시 섹션만 생략 */
      })
      .finally(() => {
        clearTimeout(timer)
        if (active) setReady(true)
      })

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  if (!ready || items.length === 0) return null

  if (oceanWarm) {
    return (
      <section
        aria-labelledby="air-hotel-product-grid-heading"
        className="ow-live-air border-b py-8 sm:py-10"
      >
        <div className={`mx-auto max-w-6xl px-3 sm:px-5 ${SITE_CONTENT_CLASS}`}>
          <h2
            id="air-hotel-product-grid-heading"
            className="ow-live-section-title text-center text-xl tracking-tight sm:text-2xl"
          >
            항공과 호텔만 필요할 때
          </h2>
          <p className="ow-live-section-body mx-auto mt-2 max-w-2xl text-center text-sm">
            국내 유명 여행사에서 검증된 호텔과 저렴한 항공권으로 가는 자유여행
          </p>
          <div className="mt-6">
            <ProductResultCardsClient items={items} layout="scroll" />
          </div>
          <div className="mt-6 flex justify-center">
            <a
              href="/travel/air-hotel"
              className="ow-live-cta-primary inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-5 text-sm font-bold"
            >
              자유여행 보기
            </a>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="air-hotel-product-grid-heading"
      className="border-b border-bt-border-soft/50 bg-bt-bg-lavender-soft/40 py-8 sm:py-10"
    >
      <div className={`mx-auto max-w-6xl px-3 sm:px-5 ${SITE_CONTENT_CLASS}`}>
        <h2
          id="air-hotel-product-grid-heading"
          className="text-center text-xl font-bold tracking-tight text-bt-text-navy sm:text-2xl"
        >
          항공+호텔 (자유여행)
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-bt-text-muted-lavender">
          항공+호텔 허브와 동일한 등록 상품 목록입니다.{' '}
          <a href="/travel/air-hotel" className="font-medium text-bt-text-navy underline-offset-2 hover:underline">
            전체 보기
          </a>
        </p>
        <div className="mt-6">
          <ProductResultCardsClient items={items} layout="scroll" />
        </div>
      </div>
    </section>
  )
}
