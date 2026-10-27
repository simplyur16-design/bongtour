'use client'

import { useRouter } from 'next/navigation'
import type { KeyboardEvent, MouseEvent } from 'react'
import { saveProductDetailCardPreview, type ProductDetailCardPreview } from '@/lib/product-detail-card-preview'

export type CardAirlinePriceLine = {
  label: string
  param: string
  priceKrw: number
  slug: string | null
  productId: string
}

/**
 * 목록 카드 — 상품 아래 항공사별 최저가 (싼 순 상위 3 + 외 N). 클릭 시 상세 `?airline=` 선택.
 * 카드 전체가 링크라 중첩 <a> 대신 role=link + router.push.
 * REGRESSION-FREEZE[airline-variant-group]: 카드 항공사별 가격줄 — manifest
 */
export default function ProductCardAirlinePriceLines({
  lines,
  moreCount,
  preview,
  formatWon,
}: {
  lines: CardAirlinePriceLine[]
  moreCount: number
  preview: ProductDetailCardPreview
  formatWon: (n: number | null) => string
}) {
  const router = useRouter()
  if (lines.length === 0) return null
  const go = (e: MouseEvent | KeyboardEvent, line: CardAirlinePriceLine) => {
    e.preventDefault()
    e.stopPropagation()
    const href = `/products/${encodeURIComponent(line.slug?.trim() || line.productId)}?airline=${encodeURIComponent(line.param)}`
    saveProductDetailCardPreview({ ...preview, href, savedAt: Date.now() })
    router.push(href)
  }
  return (
    <ul className="mt-1 space-y-0.5" data-airline-price-lines aria-label="항공사별 가격">
      {lines.map((line) => (
        <li key={line.label}>
          <span
            role="link"
            tabIndex={0}
            data-airline={line.param}
            onClick={(e) => go(e, line)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') go(e, line)
            }}
            className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-sky-800 hover:text-teal-700 hover:underline"
          >
            <span aria-hidden>✈</span>
            <span className="font-medium">{line.label}</span>
            <span>{formatWon(line.priceKrw)}~</span>
          </span>
        </li>
      ))}
      {moreCount > 0 ? <li className="text-[11px] text-slate-500">외 {moreCount}개 항공사</li> : null}
    </ul>
  )
}
