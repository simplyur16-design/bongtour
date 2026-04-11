'use client'

import { useEffect, useState } from 'react'
import GroupMeetingReviewCard from '@/app/components/travel/reviews/GroupMeetingReviewCard'
import type { GroupMeetingReviewCardModel } from '@/lib/group-meeting-reviews-csv'

type Props = {
  reviews: GroupMeetingReviewCardModel[]
}

export default function GroupMeetingReviewsMarquee({ reviews }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  if (reviews.length === 0) return null

  if (reduceMotion) {
    return (
      <ul className="mt-10 flex flex-wrap justify-center gap-4 px-1" aria-label="모임여행 후기">
        {reviews.slice(0, 6).map((r) => (
          <li key={r.id}>
            <GroupMeetingReviewCard review={r} />
          </li>
        ))}
      </ul>
    )
  }

  const loop = [...reviews, ...reviews]

  return (
    <div className="group/marquee mt-10 overflow-hidden" aria-label="모임여행 후기 롤링">
      <div
        className="flex w-max gap-4 pr-4 motion-reduce:animate-none animate-group-meeting-reviews-marquee hover:[animation-play-state:paused]"
        style={{ willChange: 'transform' }}
      >
        {loop.map((r, i) => (
          <GroupMeetingReviewCard key={`${r.id}-${i}`} review={r} />
        ))}
      </div>
    </div>
  )
}
