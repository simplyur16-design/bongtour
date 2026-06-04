'use client'

import { useMemo } from 'react'
import TravelReviewCard from '@/app/components/travel/reviews/TravelReviewCard'
import { useMobileReviewRotation } from '@/app/components/travel/reviews/useMobileReviewRotation'
import type { ReviewCardModel } from '@/lib/reviews-types'

type Props = {
  reviews: ReviewCardModel[]
}

/** 공개 후기 — 모바일 8건·10분 로테이션, md+ 전체 2~3열 그리드 */
export default function OverseasReviewsRotatingGrid({ reviews }: Props) {
  const safe = useMemo(
    () => reviews.filter((r) => r.id && r.title && r.excerpt),
    [reviews],
  )
  const { mobileReviews } = useMobileReviewRotation(safe)

  if (safe.length === 0) return null

  const renderList = (list: ReviewCardModel[], className: string, live?: boolean) => (
    <ul className={className} role="list" {...(live ? { 'aria-live': 'polite' as const } : {})}>
      {list.map((review) => (
        <li key={review.id}>
          <TravelReviewCard review={review} />
        </li>
      ))}
    </ul>
  )

  return (
    <>
      {renderList(mobileReviews, 'mt-10 grid grid-cols-2 gap-3 md:hidden', true)}
      {renderList(safe, 'mt-10 hidden gap-3 md:grid md:grid-cols-2 md:gap-5 xl:grid-cols-3')}
    </>
  )
}
