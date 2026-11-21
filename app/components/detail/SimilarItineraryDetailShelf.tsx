'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type {
  SimilarItineraryDetailCard,
  SimilarItineraryDetailDiffs,
  SimilarItineraryDetailShelf as ShelfModel,
} from '@/lib/similar-itinerary-detail-shelf'

type SortKey = 'price' | 'date' | 'supplier'

const DIFF_LABEL: Record<keyof SimilarItineraryDetailDiffs, string> = {
  airline: '항공사',
  hotel: '호텔 등급',
  shopping: '쇼핑',
  option: '옵션',
  tip: '팁',
  meal: '식사',
  price: '가격',
}

function Fact({
  label,
  value,
  differs,
}: {
  label: string
  value: string
  differs: boolean
}) {
  return (
    <p className="text-[13px] leading-5 text-bt-body">
      <span className="text-bt-meta">{label}</span>{' '}
      <span className={differs ? 'font-semibold text-bt-card-accent-strong' : 'font-medium text-bt-title'}>
        {value}
      </span>
      {differs ? <span className="ml-1 text-[11px] font-semibold text-bt-card-accent-strong">다름</span> : null}
    </p>
  )
}

function CardView({ card }: { card: SimilarItineraryDetailCard }) {
  const diffs = (Object.keys(DIFF_LABEL) as Array<keyof SimilarItineraryDetailDiffs>).filter((key) => card.differs[key])
  return (
    <Link
      href={card.href}
      data-similar-card=""
      className="group flex h-full flex-col rounded-2xl border border-bt-border bg-bt-surface p-4 shadow-[0_10px_24px_-18px_rgba(28,24,51,0.45)] outline-none transition-shadow hover:shadow-[0_16px_28px_-16px_rgba(28,24,51,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-card-accent-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-bt-card-title">{card.supplierLabel}</p>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-bt-title">{card.priceLabel}</p>
      </div>
      <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-bt-title group-hover:underline">
        {card.title}
      </h3>
      <p className="mt-1 text-xs text-bt-meta">
        {card.durationLabel}
        {card.durationMatch === 'near' ? ' · 하루 차이' : ''} · {card.departureLabel}
      </p>
      <div className="mt-3 space-y-1">
        <Fact label="항공" value={card.airlineLabel} differs={card.differs.airline} />
        <Fact label="호텔" value={card.hotelGradeLabel} differs={card.differs.hotel} />
        <Fact label="쇼핑" value={card.shoppingLabel} differs={card.differs.shopping} />
        <Fact label="옵션" value={card.optionLabel} differs={card.differs.option} />
        <Fact label="팁" value={card.tipLabel} differs={card.differs.tip} />
        <Fact label="식사" value={card.mealLabel} differs={card.differs.meal} />
      </div>
      {diffs.length > 0 ? (
        <p className="mt-3 text-xs font-medium text-bt-card-accent-strong">
          이 상품과 다른 점 · {diffs.map((key) => DIFF_LABEL[key]).join(' · ')}
        </p>
      ) : (
        <p className="mt-3 text-xs text-bt-meta">보는 중인 상품과 같은 사실</p>
      )}
    </Link>
  )
}

export default function SimilarItineraryDetailShelf({ shelf }: { shelf: ShelfModel | null | undefined }) {
  const [noShopping, setNoShopping] = useState(false)
  const [noTip, setNoTip] = useState(false)
  const [sameWeek, setSameWeek] = useState(false)
  const [sort, setSort] = useState<SortKey>('price')

  const cards = useMemo(() => {
    const list = (shelf?.cards ?? []).filter((card) => {
      if (noShopping && !card.noShopping) return false
      if (noTip && !card.noTip) return false
      if (sameWeek && !card.sameWeek) return false
      return true
    })
    const copy = [...list]
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
  }, [shelf, noShopping, noTip, sameWeek, sort])

  if (!shelf || shelf.cards.length === 0) return null

  return (
    <section aria-labelledby="similar-itinerary-heading" data-similar-shelf="" className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="similar-itinerary-heading" className="border-l-4 border-bt-card-title pl-3 text-lg font-semibold text-bt-card-title">
            비슷한 일정 상품
          </h2>
          <p className="mt-2 pl-4 text-sm text-bt-body">
            {shelf.placeLabel} · {shelf.durationLabel}
            {shelf.widened ? ' · 같은 기간이 적어 하루 차이까지 포함' : ''}
          </p>
        </div>
        {shelf.compareHref ? (
          <Link href={shelf.compareHref} className="text-sm font-medium text-bt-card-accent-strong underline-offset-4 hover:underline">
            공급사별 표로 보기
          </Link>
        ) : null}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChip pressed={noShopping} onClick={() => setNoShopping((v) => !v)}>
          노쇼핑
        </FilterChip>
        <FilterChip pressed={noTip} onClick={() => setNoTip((v) => !v)}>
          노팁
        </FilterChip>
        <FilterChip pressed={sameWeek} onClick={() => setSameWeek((v) => !v)}>
          {shelf.weekLabel ? `같은 주 ${shelf.weekLabel}` : '같은 주'}
        </FilterChip>
        <label className="ml-auto flex items-center gap-2 text-sm text-bt-body">
          정렬
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-bt-border bg-bt-surface px-2 py-1.5 text-sm text-bt-title outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-card-accent-strong"
          >
            <option value="price">가격 낮은 순</option>
            <option value="date">출발 빠른 순</option>
            <option value="supplier">공급사</option>
          </select>
        </label>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-2xl border border-bt-border bg-bt-surface px-4 py-6 text-sm text-bt-body">
          이 조건에 맞는 상품이 없습니다. 필터를 끄면 다시 볼 수 있습니다.
        </p>
      ) : (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 min-[430px]:grid min-[430px]:grid-cols-2 min-[430px]:overflow-visible min-[1100px]:grid-cols-3">
          {cards.map((card) => (
            <div key={card.id} className="w-[86%] shrink-0 snap-start min-[430px]:w-auto">
              <CardView card={card} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-card-accent-strong ${
        pressed
          ? 'border-bt-card-title bg-bt-card-title text-white'
          : 'border-bt-border bg-bt-surface text-bt-body hover:bg-bt-surface-soft'
      }`}
    >
      {children}
    </button>
  )
}
