'use client'

import { useEffect, useState, useRef } from 'react'
import type { GroupMeetingReviewCardModel } from '@/lib/group-meeting-reviews-csv'

type Props = {
  reviews: GroupMeetingReviewCardModel[]
}

const PC_CARD_COUNT = 6
const MOBILE_CARD_COUNT = 1
const FLIP_INTERVAL_MS = 4000
const FLIP_ANIMATION_MS = 800
const BACK_VISIBLE_MS = 2500
/** 앞→뒤 / 뒤→앞 전환 중간(≈90°) — 이 시점에 슬롯 데이터 교체해 뒷면 색·태그 깜빡임 방지 */
const HALF_FLIP_MS = Math.floor(FLIP_ANIMATION_MS / 2)

const EASE_OUT_QUINT = 'cubic-bezier(0.23, 1, 0.32, 1)'

const REVIEW_TYPE_STYLES: Record<
  string,
  {
    gradient: string
    badge: string
    emoji: string
  }
> = {
  group_corporate: {
    gradient: 'from-blue-100 to-indigo-200',
    badge: 'border border-blue-200 bg-blue-50 text-blue-700',
    emoji: '🏢',
  },
  group_friends: {
    gradient: 'from-pink-100 to-rose-200',
    badge: 'border border-pink-200 bg-pink-50 text-pink-700',
    emoji: '🎉',
  },
  group_small: {
    gradient: 'from-purple-100 to-fuchsia-200',
    badge: 'border border-purple-200 bg-purple-50 text-purple-700',
    emoji: '👥',
  },
  parents: {
    gradient: 'from-amber-100 to-orange-200',
    badge: 'border border-amber-200 bg-amber-50 text-amber-700',
    emoji: '💝',
  },
  hiking: {
    gradient: 'from-emerald-100 to-green-200',
    badge: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    emoji: '⛰️',
  },
  default: {
    gradient: 'from-slate-100 to-gray-200',
    badge: 'border border-slate-200 bg-slate-50 text-slate-700',
    emoji: '✈️',
  },
}

function getReviewTypeStyle(reviewType: string) {
  return REVIEW_TYPE_STYLES[reviewType] ?? REVIEW_TYPE_STYLES.default
}

export default function GroupMeetingReviewsFlipGrid({ reviews }: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [displayedReviews, setDisplayedReviews] = useState<GroupMeetingReviewCardModel[]>([])
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const nextPoolIndexRef = useRef<number>(0)
  const currentTargetRef = useRef<number>(0)
  const shuffledPoolRef = useRef<GroupMeetingReviewCardModel[]>([])
  const slotCountRef = useRef<number>(0)
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingMidFlipSwapRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // 리스트/리뷰 소스 변경 시에만 대기 timeout 정리 (호버로 interval만 갱신될 때는 유지)
  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current)
        pendingTimeoutRef.current = null
      }
      if (pendingMidFlipSwapRef.current) {
        clearTimeout(pendingMidFlipSwapRef.current)
        pendingMidFlipSwapRef.current = null
      }
    }
  }, [displayedReviews.length, reviews])

  // 자동 뒤집기 사이클
  useEffect(() => {
    if (displayedReviews.length === 0) return

    const interval = setInterval(() => {
      if (hoveredIndex !== null) return

      const targetIndex = currentTargetRef.current

      // 1단계: 앞 → 뒤
      setFlippedIndex(targetIndex)

      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current)
      if (pendingMidFlipSwapRef.current) {
        clearTimeout(pendingMidFlipSwapRef.current)
        pendingMidFlipSwapRef.current = null
      }

      pendingTimeoutRef.current = setTimeout(() => {
        pendingTimeoutRef.current = null

        // 2단계: 뒤 → 앞 시작 (교체는 아직 안 함)
        setFlippedIndex(null)

        // 3단계: 뒤집기 중간(측면)에서 풀 데이터 교체 → 새 앞면이 맞닿아 보이도록
        pendingMidFlipSwapRef.current = setTimeout(() => {
          pendingMidFlipSwapRef.current = null

          const pool = shuffledPoolRef.current
          let poolIdx = nextPoolIndexRef.current

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

          nextPoolIndexRef.current = poolIdx + 1
          const slots = slotCountRef.current || 1
          currentTargetRef.current = (targetIndex + 1) % slots
        }, HALF_FLIP_MS)
      }, BACK_VISIBLE_MS)
    }, FLIP_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current)
        pendingTimeoutRef.current = null
      }
      if (pendingMidFlipSwapRef.current) {
        clearTimeout(pendingMidFlipSwapRef.current)
        pendingMidFlipSwapRef.current = null
      }
    }
  }, [displayedReviews.length, reviews, hoveredIndex])

  if (!reviews.length) return null

  return (
    <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
      {displayedReviews.map((review, idx) => (
        <FlipCard
          key={`slot-${idx}`}
          review={review}
          flipped={flippedIndex === idx}
          isHovered={hoveredIndex === idx}
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        />
      ))}
    </div>
  )
}

type FlipCardProps = {
  review: GroupMeetingReviewCardModel
  flipped: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function FlipCard({ review, flipped, isHovered, onMouseEnter, onMouseLeave }: FlipCardProps) {
  const frontExpanded = isHovered && !flipped
  const style = getReviewTypeStyle(review.review_type)

  const transitionStyle = {
    transitionProperty: 'transform',
    transitionDuration: `${FLIP_ANIMATION_MS}ms`,
    transitionTimingFunction: EASE_OUT_QUINT,
  } as const

  const innerShell =
    isHovered
      ? `absolute left-0 right-0 top-0 z-30 w-full rounded-2xl shadow-xl ring-1 ring-black/5 ${
          frontExpanded ? 'grid min-h-[280px] grid-cols-1 grid-rows-1' : 'h-[280px]'
        }`
      : 'relative h-full min-h-0 w-full'

  return (
    <div
      className={`relative h-[280px] [perspective:1000px] rounded-2xl ${isHovered ? 'z-20 overflow-visible' : 'overflow-hidden'}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={`${innerShell} transition-transform [transform-style:preserve-3d] ${
          flipped ? '[transform:rotateY(180deg)]' : ''
        }`}
        style={transitionStyle}
      >
        {/* 앞면 */}
        <div
          className={`flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-md [backface-visibility:hidden] ${
            frontExpanded ? 'col-start-1 row-start-1 min-h-[280px] w-full' : 'absolute inset-0 min-h-[280px]'
          }`}
        >
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">⭐</span>
              <span className="text-sm font-semibold">{review.ratingLabel || '5.0'}</span>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${style.badge}`}>{review.purposeLabel}</span>
          </div>

          <h3 className="mb-2 line-clamp-2 text-base font-bold leading-snug">{review.title}</h3>

          <p
            className={`flex-1 text-sm leading-relaxed text-gray-600 ${
              isHovered ? '' : 'line-clamp-3 min-h-0'
            }`}
          >
            {review.bodyLines}
          </p>

          <div className="mt-auto shrink-0 border-t border-gray-100 pt-3">
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
        <div
          className={`flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br p-6 shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)] ${style.gradient} ${
            frontExpanded ? 'col-start-1 row-start-1 min-h-[280px] w-full' : 'absolute inset-0 min-h-[280px]'
          }`}
        >
          <div className="mb-3 text-4xl">{style.emoji}</div>

          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {review.displayTags.slice(0, 5).map((tag) => (
              <span
                key={`${review.id}-${tag}`}
                className="rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold text-gray-800 backdrop-blur"
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="mt-2 text-center text-sm text-gray-700">
            {review.purposeLabel}
            {review.destination_country != null && review.destination_country !== ''
              ? ` · ${review.destination_country}`
              : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
