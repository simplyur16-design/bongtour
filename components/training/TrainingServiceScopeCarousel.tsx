'use client'

import { useCallback, useRef, useState } from 'react'
import type { TRAINING_SERVICE_OPTIONS } from '@/components/inquiry/TrainingInquiryForm'

type ServiceType = (typeof TRAINING_SERVICE_OPTIONS)[number]

export type TrainingServiceScopeCard = {
  title: ServiceType
  summary: string
  fitCases: string[]
}

type Props = {
  cards: TrainingServiceScopeCard[]
  onInquiry: (service: ServiceType) => void
}

function scopeBadgeLabel(title: ServiceType): string {
  if (title === '연수기관 섭외만') return '기관 연결 중심'
  if (title === '연수기획·진행 및 연수기관 섭외') return '전체 운영형'
  return '기획·진행 중심'
}

function ServiceScopeCardArticle({
  card,
  onInquiry,
}: {
  card: TrainingServiceScopeCard
  onInquiry: (service: ServiceType) => void
}) {
  return (
    <article className="flex h-full flex-col items-center rounded-xl border border-bt-border bg-white p-5 text-center shadow-sm">
      <p className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
        {scopeBadgeLabel(card.title)}
      </p>
      <h3 className="mt-3 text-[26px] font-semibold leading-[1.34] tracking-[-0.005em] text-slate-900">{card.title}</h3>
      <p className="mt-3 text-[17px] leading-[1.6] text-slate-700">{card.summary}</p>
      <button
        type="button"
        onClick={() => onInquiry(card.title)}
        className="mt-4 inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-[16px] font-semibold text-slate-800 hover:bg-slate-50"
      >
        문의하기
      </button>
      <details className="mt-3 w-full">
        <summary className="cursor-pointer list-none text-xs font-medium text-slate-500 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
          추가 정보 보기
        </summary>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {card.fitCases.map((c) => (
            <li key={c}>- {c}</li>
          ))}
        </ul>
      </details>
    </article>
  )
}

export default function TrainingServiceScopeCarousel({ cards, onInquiry }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const onScroll = useCallback(() => {
    const root = scrollRef.current
    if (!root || cards.length === 0) return
    if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      const center = root.scrollLeft + root.clientWidth / 2
      let bestIdx = 0
      let bestDist = Infinity
      Array.from(root.children).forEach((child, idx) => {
        const el = child as HTMLElement
        const mid = el.offsetLeft + el.offsetWidth / 2
        const dist = Math.abs(mid - center)
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = idx
        }
      })
      setActiveIndex((prev) => (prev === bestIdx ? prev : bestIdx))
    })
  }, [cards.length])

  return (
    <>
      <p className="mb-3 text-center text-sm text-slate-600 lg:hidden">
        좌우로 밀어 문의 유형을 비교해 보세요
      </p>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 touch-pan-x [scrollbar-width:thin] lg:hidden"
        aria-label="문의 범위 유형"
      >
        {cards.map((card) => (
          <div key={card.title} className="w-[90%] max-w-md shrink-0 snap-center">
            <ServiceScopeCardArticle card={card} onInquiry={onInquiry} />
          </div>
        ))}
      </div>

      {cards.length > 1 ? (
        <div className="mt-3 flex justify-center gap-2 lg:hidden" aria-hidden>
          {cards.map((card, idx) => (
            <span
              key={card.title}
              className={`h-2 rounded-full transition-all ${
                activeIndex === idx ? 'w-6 bg-slate-900' : 'w-2 bg-slate-300'
              }`}
            />
          ))}
        </div>
      ) : null}

      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        {cards.map((card) => (
          <ServiceScopeCardArticle key={card.title} card={card} onInquiry={onInquiry} />
        ))}
      </div>
    </>
  )
}
