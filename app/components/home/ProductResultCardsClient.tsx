'use client'

import { useEffect, useState } from 'react'
import { ProductResultCard, type ResultItem } from '@/components/products/ProductResultsList'

function formatWon(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '상담 문의'
  return `${new Intl.NumberFormat('ko-KR').format(Math.trunc(n))}원`
}

type Layout = 'grid' | 'scroll'

export default function ProductResultCardsClient({
  items,
  layout,
}: {
  items: ResultItem[]
  layout: Layout
}) {
  const [compactCard, setCompactCard] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setCompactCard(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  if (items.length === 0) return null

  if (layout === 'scroll') {
    return (
      <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[min(11rem,calc((100vw-2.75rem)/2))] shrink-0 snap-center md:w-[min(17.5rem,calc(100vw-2.75rem))] md:snap-start"
          >
            <ProductResultCard item={item} formatWon={formatWon} compact={compactCard} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <ProductResultCard key={item.id} item={item} formatWon={formatWon} />
      ))}
    </div>
  )
}
