'use client'

import { useEffect, useState } from 'react'
import { ProductResultCard, type ResultItem } from '@/components/products/ProductResultsList'
import HorizontalScrollWithArrows from '@/components/ui/HorizontalScrollWithArrows'
import { MAIN_MENU_PRODUCT_CARD_GRID_CLASS } from '@/lib/hub-main-menu-card-layout'
import { MOBILE_HUB_COMPACT_CARD_WIDTH_CLASS } from '@/lib/mobile-hub-scroll-layout'

function formatWon(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '상담 문의'
  return `${new Intl.NumberFormat('ko-KR').format(Math.trunc(n))}원`
}

type Layout = 'grid' | 'scroll'

/** REGRESSION-FREEZE[home-hero-lcp-and-section-titles]: grid는 matchMedia 구독 없음 — manifest */
function ProductResultCardsGrid({ items }: { items: ResultItem[] }) {
  return (
    <div className={MAIN_MENU_PRODUCT_CARD_GRID_CLASS}>
      {items.map((item) => (
        <ProductResultCard key={item.id} item={item} formatWon={formatWon} />
      ))}
    </div>
  )
}

function ProductResultCardsScroll({ items }: { items: ResultItem[] }) {
  const [compactCard, setCompactCard] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setCompactCard(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <HorizontalScrollWithArrows
      scrollClassName="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`${MOBILE_HUB_COMPACT_CARD_WIDTH_CLASS} md:w-[min(17.5rem,calc(100vw-2.75rem))] md:snap-start`}
        >
          <ProductResultCard item={item} formatWon={formatWon} compact={compactCard} />
        </div>
      ))}
    </HorizontalScrollWithArrows>
  )
}

export default function ProductResultCardsClient({
  items,
  layout,
}: {
  items: ResultItem[]
  layout: Layout
}) {
  if (items.length === 0) return null
  if (layout === 'grid') return <ProductResultCardsGrid items={items} />
  return <ProductResultCardsScroll items={items} />
}
