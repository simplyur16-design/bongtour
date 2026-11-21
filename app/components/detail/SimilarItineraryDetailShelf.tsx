'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { SimilarItineraryDetailShelf as ShelfModel } from '@/lib/similar-itinerary-detail-shelf'

type SortKey = 'price' | 'date' | 'supplier'

const VISIBLE_COUNT = 5

function shortDeparture(label: string, count: number): string {
  const dated = label.match(/(\d{1,2}\/\d{1,2}\([^)]+\))/)
  const nearest = dated?.[1]
  if (!nearest) return label
  if (count > 1) return `${nearest} · ${count}일`
  return nearest
}

function Row({
  supplier,
  title,
  departure,
  airline,
  shopping,
  option,
  price,
  href,
}: {
  supplier: string
  title: string
  departure: string
  airline: string
  shopping: string
  option: string
  price: string
  href: string
}) {
  return (
    <Link
      href={href}
      data-similar-card=""
      className="group block border-b border-bt-border-soft px-1 py-2.5 outline-none last:border-b-0 hover:bg-bt-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-card-accent-strong"
    >
      <span className="flex min-w-0 items-baseline gap-2 sm:gap-3">
        <span className="w-16 shrink-0 text-xs font-semibold text-bt-card-title sm:w-[4.5rem] sm:text-sm">{supplier}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-bt-title group-hover:underline">{title}</span>
        <span className="hidden shrink-0 text-xs tabular-nums text-bt-meta sm:inline">{departure}</span>
        <span className="hidden max-w-[5.5rem] shrink-0 truncate text-xs text-bt-body sm:inline">{airline}</span>
        <span className="hidden shrink-0 text-xs text-bt-body sm:inline">{shopping}</span>
        <span className="hidden max-w-[8.5rem] shrink-0 truncate text-xs text-bt-body sm:inline">{option}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-bt-title">{price}</span>
      </span>
      <span className="mt-0.5 block truncate pl-[4.5rem] text-xs text-bt-body sm:hidden">
        {departure} · {airline} · {shopping} · {option}
      </span>
    </Link>
  )
}

export default function SimilarItineraryDetailShelf({ shelf }: { shelf: ShelfModel | null | undefined }) {
  const [sort, setSort] = useState<SortKey>('price')
  const [expanded, setExpanded] = useState(false)

  const cards = useMemo(() => {
    const copy = [...(shelf?.cards ?? [])]
    copy.sort((a, b) => {
      if (sort === 'supplier') return a.supplierLabel.localeCompare(b.supplierLabel, 'ko')
      if (sort === 'date') {
        if (!a.departureSort && !b.departureSort) return 0
        if (!a.departureSort) return 1
        if (!b.departureSort) return -1
        return a.departureSort.localeCompare(b.departureSort)
      }
      if (a.priceSort == null && b.priceSort == null) return 0
      if (a.priceSort == null) return 1
      if (b.priceSort == null) return -1
      return a.priceSort - b.priceSort
    })
    return copy
  }, [shelf, sort])

  if (!shelf || cards.length === 0) return null
  const visible = expanded ? cards : cards.slice(0, VISIBLE_COUNT)
  const hiddenCount = cards.length - visible.length

  return (
    <section aria-labelledby="similar-itinerary-heading" data-similar-shelf="" className="mt-8">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h2 id="similar-itinerary-heading" className="text-base font-semibold text-bt-card-title">
          비슷한 일정 상품
          <span className="ml-2 text-sm font-medium text-bt-meta">
            {shelf.placeLabel} · {shelf.durationLabel}
            {shelf.widened ? ' · 하루 차이 포함' : ''}
          </span>
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-bt-meta">
          정렬
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-bt-border bg-bt-surface px-1.5 py-1 text-xs text-bt-title outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-card-accent-strong"
          >
            <option value="price">가격 낮은 순</option>
            <option value="date">출발 빠른 순</option>
            <option value="supplier">공급사</option>
          </select>
        </label>
      </div>
      <div className="border-t border-bt-border-soft">
        {visible.map((card) => (
          <Row
            key={card.id}
            href={card.href}
            supplier={card.supplierLabel}
            title={card.title}
            departure={shortDeparture(card.departureLabel, card.departureCount)}
            airline={card.airlineLabel}
            shopping={card.shoppingLabel}
            option={card.optionLabel}
            price={card.priceLabel}
          />
        ))}
      </div>
      {cards.length > VISIBLE_COUNT ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-2 text-sm font-medium text-bt-card-accent-strong underline-offset-4 hover:underline"
        >
          {expanded ? '접기' : `더 보기 ${hiddenCount}개`}
        </button>
      ) : null}
    </section>
  )
}
