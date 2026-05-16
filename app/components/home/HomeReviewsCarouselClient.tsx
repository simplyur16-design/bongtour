'use client'

import { useEffect, useState } from 'react'
import { HomeReviewGridCard } from '@/app/components/home/HomeReviewsGridClient'
import { HOME_REVIEW_CAROUSEL_INTERVAL_MS } from '@/lib/home-reviews-split'
import type { ReviewCardModel } from '@/lib/reviews-types'

type Props = {
  reviews: ReviewCardModel[]
  intervalMs?: number
}

/** 메인 모임여행 후기 — 1장 carousel, 기본 6초 간격 */
export default function HomeReviewsCarouselClient({
  reviews,
  intervalMs = HOME_REVIEW_CAROUSEL_INTERVAL_MS,
}: Props) {
  const safe = reviews.filter((r) => r.id && r.title && r.excerpt)
  const n = safe.length
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (n <= 1) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % n)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [n, intervalMs])

  if (n === 0) return null

  const current = safe[index]!

  return (
    <div
      className="mx-auto max-w-md"
      aria-live="polite"
      aria-atomic="true"
      aria-roledescription="carousel"
    >
      <div key={current.id}>
        <HomeReviewGridCard review={current} />
      </div>
      {n > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="후기 슬라이드">
          {safe.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`후기 ${i + 1} / ${n}`}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-bt-text-navy' : 'w-2 bg-bt-border-soft'
              }`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
