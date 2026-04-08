'use client'

import { useEffect, useState } from 'react'
import TravelReviewCard from '@/app/components/travel/reviews/TravelReviewCard'
import type { ReviewCardModel } from '@/lib/reviews-types'

type Props = {
  reviews: ReviewCardModel[]
  visibleCount: number
  intervalMs: number
}

/** 공개 후기 N건 중 visibleCount 장씩 순환 표시 */
export default function OverseasReviewsRotatingGrid({ reviews, visibleCount, intervalMs }: Props) {
  const n = reviews.length
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (n <= visibleCount) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const id = window.setInterval(() => {
      setOffset((o) => (o + 1) % n)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [n, visibleCount, intervalMs])

  if (n === 0) return null

  const take = Math.min(visibleCount, n)
  const slice: ReviewCardModel[] = []
  for (let i = 0; i < take; i++) {
    slice.push(reviews[(offset + i) % n]!)
  }

  return (
    <ul
      className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
      aria-live="polite"
      aria-atomic="true"
    >
      {slice.map((review) => (
        <li key={review.id}>
          <TravelReviewCard review={review} />
        </li>
      ))}
    </ul>
  )
}
