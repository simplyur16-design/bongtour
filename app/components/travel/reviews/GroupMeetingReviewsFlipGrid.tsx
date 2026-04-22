'use client'

import { useEffect, useState, useRef } from 'react'
import type { GroupMeetingReviewCardModel } from '@/lib/group-meeting-reviews-csv'

type Props = {
  reviews: GroupMeetingReviewCardModel[]
}

const PC_CARD_COUNT = 6
const MOBILE_CARD_COUNT = 1
const FLIP_INTERVAL_MS = 4000
const FLIP_ANIMATION_MS = 600
const BACK_VISIBLE_MS = 2500

export default function GroupMeetingReviewsFlipGrid({ reviews }: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [displayedReviews, setDisplayedReviews] = useState<GroupMeetingReviewCardModel[]>([])
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null)
  const nextPoolIndexRef = useRef<number>(0)
  const currentTargetRef = useRef<number>(0)
  const shuffledPoolRef = useRef<GroupMeetingReviewCardModel[]>([])
  const slotCountRef = useRef<number>(0)
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 반응형 감지
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 초기화 및 shuffle
  useEffect(() => {
    if (!reviews.length) return

    const shuffled = [...reviews].sort(() => Math.random() - 0.5)
    shuffledPoolRef.current = shuffled

    const initialCount = isMobile ? MOBILE_CARD_COUNT : PC_CARD_COUNT
    const initial = shuffled.slice(0, initialCount)
    slotCountRef.current = initial.length
    setDisplayedReviews(initial)
    nextPoolIndexRef.current = initialCount
    currentTargetRef.current = 0
  }, [reviews, isMobile])

  // 자동 뒤집기 사이클
  useEffect(() => {
    if (displayedReviews.length === 0) return

    const interval = setInterval(() => {
      const targetIndex = currentTargetRef.current

      // 1단계: 카드 뒤집기 (앞 → 뒤)
      setFlippedIndex(targetIndex)

      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current)
      pendingTimeoutRef.current = setTimeout(() => {
        pendingTimeoutRef.current = null
        const pool = shuffledPoolRef.current
        let poolIdx = nextPoolIndexRef.current

        // 풀 끝나면 다시 섞고 처음부터
        if (poolIdx >= pool.length) {
          shuffledPoolRef.current = [...reviews].sort(() => Math.random() - 0.5)
          poolIdx = 0
        }

        const newReview = shuffledPoolRef.current[poolIdx]

        setDisplayedReviews((prev) => {
          const updated = [...prev]
          updated[targetIndex] = newReview
          return updated
        })
        setFlippedIndex(null)

        nextPoolIndexRef.current = poolIdx + 1
        const slots = slotCountRef.current || 1
        currentTargetRef.current = (targetIndex + 1) % slots
      }, BACK_VISIBLE_MS)
    }, FLIP_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current)
        pendingTimeoutRef.current = null
      }
    }
  }, [displayedReviews.length, reviews])

  if (!reviews.length) return null

  return (
    <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
      {displayedReviews.map((review, idx) => (
        <FlipCard key={`slot-${idx}`} review={review} flipped={flippedIndex === idx} />
      ))}
    </div>
  )
}

function FlipCard({ review, flipped }: { review: GroupMeetingReviewCardModel; flipped: boolean }) {
  return (
    <div className="relative h-[280px] [perspective:1000px]">
      <div
        className={`relative h-full w-full transition-transform [transform-style:preserve-3d] ${
          flipped ? '[transform:rotateY(180deg)]' : ''
        }`}
        style={{ transitionDuration: `${FLIP_ANIMATION_MS}ms` }}
      >
        {/* 앞면 */}
        <div className="absolute inset-0 flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-md [backface-visibility:hidden]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">⭐</span>
              <span className="text-sm font-semibold">{review.ratingLabel || '5.0'}</span>
            </div>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{review.purposeLabel}</span>
          </div>

          <h3 className="mb-2 line-clamp-2 text-base font-bold leading-snug">{review.title}</h3>

          <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-gray-600">{review.bodyLines}</p>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                🌏 {review.destination_country}
                {review.destination_city ? ` · ${review.destination_city}` : ''}
              </span>
              {review.dateLabel ? <span>{review.dateLabel}</span> : null}
            </div>
          </div>
        </div>

        {/* 뒷면 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 p-6 text-white shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {review.displayTags.slice(0, 5).map((tag) => (
              <span
                key={`${review.id}-${tag}`}
                className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold backdrop-blur"
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="mt-2 text-center text-sm opacity-90">
            {review.purposeLabel}
            {review.destination_country ? ` · ${review.destination_country}` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
