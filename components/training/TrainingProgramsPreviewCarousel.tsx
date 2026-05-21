'use client'

import { useCallback, useRef, useState } from 'react'
import TrainingProgramCard from '@/components/training/TrainingProgramCard'
import type { TrainingProgramPublicRow } from '@/lib/overseas-training-program-query'

type Props = {
  programs: TrainingProgramPublicRow[]
}

export default function TrainingProgramsPreviewCarousel({ programs }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const onScroll = useCallback(() => {
    const root = scrollRef.current
    if (!root || programs.length === 0) return
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
  }, [programs.length])

  if (programs.length === 0) return null

  return (
    <>
      <p className="mb-3 text-center text-sm text-slate-600 md:hidden">
        좌우로 밀어 다른 연수 프로그램을 확인하세요
      </p>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 touch-pan-x [scrollbar-width:thin] md:hidden"
        aria-label="연수 프로그램 목록"
      >
        {programs.map((p) => (
          <div key={p.id} className="w-[90%] max-w-sm shrink-0 snap-center">
            <TrainingProgramCard program={p} />
          </div>
        ))}
      </div>

      {programs.length > 1 ? (
        <div className="mt-3 flex justify-center gap-2 md:hidden" aria-hidden>
          {programs.map((p, idx) => (
            <span
              key={p.id}
              className={`h-2 rounded-full transition-all ${
                activeIndex === idx ? 'w-6 bg-slate-900' : 'w-2 bg-slate-300'
              }`}
            />
          ))}
        </div>
      ) : null}

      <div className="hidden gap-5 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {programs.map((p) => (
          <TrainingProgramCard key={p.id} program={p} />
        ))}
      </div>
    </>
  )
}
