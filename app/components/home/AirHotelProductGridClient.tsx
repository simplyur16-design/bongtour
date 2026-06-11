'use client'

import { useEffect, useState } from 'react'
import ProductResultCardsClient from '@/app/components/home/ProductResultCardsClient'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { HUB_BROWSE_CLIENT_FETCH_TIMEOUT_MS } from '@/lib/products-browse-hub-prefetch-timeout'
import type { ResultItem } from '@/components/products/ProductResultsList'

/** 메인 그리드 — 허브 전량(1만)이 아닌 미리보기만 요청 */
const HOME_AIR_HOTEL_PREVIEW_LIMIT = '20'

type BrowseOk = { ok: true; items: ResultItem[] }

export default function AirHotelProductGridClient() {
  const [items, setItems] = useState<ResultItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    const qs = new URLSearchParams({
      scope: 'overseas',
      type: 'air-hotel',
      limit: HOME_AIR_HOTEL_PREVIEW_LIMIT,
      page: '1',
    })
    const timer = setTimeout(() => {
      if (active) setReady(true)
    }, HUB_BROWSE_CLIENT_FETCH_TIMEOUT_MS)

    void fetch(`/api/products/browse?${qs.toString()}`)
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
