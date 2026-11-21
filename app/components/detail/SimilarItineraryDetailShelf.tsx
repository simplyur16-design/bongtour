'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  formatAdultPriceDelta,
  pickSimilarListPins,
  type SimilarItineraryDetailCard,
  type SimilarItineraryDetailShelf as ShelfModel,
} from '@/lib/similar-itinerary-detail-shelf'

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
  card,
  anchorAdultKrw,
  pinLabel,
}: {
  card: SimilarItineraryDetailCard
  anchorAdultKrw: number | null
  pinLabel?: string
}) {
  const delta = formatAdultPriceDelta(card.adultKrw, anchorAdultKrw)
  const departure = shortDeparture(card.departureLabel, card.departureCount)
  return (
    <Link
      href={card.href}
      data-similar-card=""
      className="group block border-b border-bt-border-soft px-1 py-2.5 outline-none last:border-b-0 hover:bg-bt-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-card-accent-strong"
    >
      {pinLabel ? <span className="mb-0.5 block text-[11px] font-semibold text-bt-card-accent-strong">{pinLabel}</span> : null}
      <span className="flex min-w-0 items-baseline gap-2 sm:gap-3">
        <span className="w-16 shrink-0 text-xs font-semibold text-bt-card-title sm:w-[4.5rem] sm:text-sm">{card.supplierLabel}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-bt-title group-hover:underline">{card.title}</span>
        <span className="hidden shrink-0 text-xs tabular-nums text-bt-meta sm:inline">{departure}</span>
        <span className="hidden max-w-[5.5rem] shrink-0 truncate text-xs text-bt-body sm:inline">{card.airlineLabel}</span>
        <span className="hidden shrink-0 text-xs text-bt-body sm:inline">{card.shoppingLabel}</span>
        <span className="hidden max-w-[8.5rem] shrink-0 truncate text-xs text-bt-body sm:inline">{card.optionLabel}</span>
        <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-bt-title">
          {card.priceLabel}
          {delta ? <span className="ml-1.5 text-xs font-medium text-bt-meta">{delta}</span> : null}
        </span>
      </span>
      <span className="mt-0.5 block truncate pl-[4.5rem] text-xs text-bt-body sm:hidden">
        {departure} · {card.airlineLabel} · {card.shoppingLabel} · {card.optionLabel}
      </span>
    </Link>
  )
}

export default function SimilarItineraryDetailShelf({ shelf }: { shelf: ShelfModel | null | undefined }) {
  const [open, setOpen] = useState(false)
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

  const pins = useMemo(() => pickSimilarListPins(cards), [cards])
  const pinIds = useMemo(() => new Set(pins.map((pin) => pin.id)), [pins])
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const rest = cards.filter((card) => !pinIds.has(card.id))
  const visibleRest = expanded ? rest : rest.slice(0, VISIBLE_COUNT)
  const hiddenCount = rest.length - visibleRest.length

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!shelf || cards.length === 0) return null

  return (
    <section aria-labelledby="similar-itinerary-heading" data-similar-shelf="" className="mt-8">
      <h2 id="similar-itinerary-heading" className="sr-only">
        여행사별 비교
      </h2>
      <button
        type="button"
        data-similar-open=""
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-bt-border bg-bt-surface px-4 py-3 text-left outline-none hover:bg-bt-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-card-accent-strong"
      >
        <span className="text-sm font-semibold text-bt-card-title">
          여행사별 비교하기
          <span className="ml-1.5 text-xs font-medium text-bt-meta">{cards.length}개</span>
        </span>
        <span className="shrink-0 text-sm text-bt-card-accent-strong" aria-hidden>
          열기
        </span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="여행사별 비교 닫기" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="similar-itinerary-dialog-title"
            data-similar-panel=""
            className="relative flex max-h-[86vh] w-full flex-col rounded-t-2xl bg-bt-surface shadow-[0_18px_50px_-24px_rgba(28,24,51,0.55)] sm:max-w-4xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-bt-border-soft px-4 py-3">
              <div>
                <h3 id="similar-itinerary-dialog-title" className="text-base font-semibold text-bt-card-title">
                  여행사별 비교
                </h3>
                <p className="mt-0.5 text-xs text-bt-meta">
                  {shelf.placeLabel} · {shelf.durationLabel}
                  {shelf.widened ? ' · 하루 차이 포함' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-bt-meta">
                  정렬
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortKey)}
                    className="rounded-md border border-bt-border bg-bt-surface px-1.5 py-1 text-xs text-bt-title outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-card-accent-strong"
                  >
                    <option value="price">가격 낮은 순</option>
                    <option value="date">출발 빠른 순</option>
                    <option value="supplier">공급사</option>
                  </select>
                </label>
                <button type="button" onClick={() => setOpen(false)} className="px-2 py-1 text-sm text-bt-body">
                  닫기
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-4 py-2">
              {pins.length > 0 ? (
                <div className="border-b border-bt-border">
                  {pins.map((pin) => {
                    const card = byId.get(pin.id)
                    if (!card) return null
                    return (
                      <Row
                        key={pin.id}
                        card={card}
                        anchorAdultKrw={shelf.anchorAdultKrw}
                        pinLabel={pin.labels.join(' · ')}
                      />
                    )
                  })}
                </div>
              ) : null}
              <div>
                {visibleRest.map((card) => (
                  <Row key={card.id} card={card} anchorAdultKrw={shelf.anchorAdultKrw} />
                ))}
              </div>
              {rest.length > VISIBLE_COUNT ? (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="mt-2 mb-1 text-sm font-medium text-bt-card-accent-strong underline-offset-4 hover:underline"
                >
                  {expanded ? '접기' : `더 보기 ${hiddenCount}개`}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
