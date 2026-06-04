'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  MOBILE_REVIEW_ROTATE_INTERVAL_MS,
  MOBILE_REVIEW_VISIBLE_MAX,
  pickRotatingReviewWindow,
} from '@/lib/reviews-mobile-display'
import type { ReviewCardModel } from '@/lib/reviews-types'

export function useMobileReviewRotation(reviews: readonly ReviewCardModel[]) {
  const [chunkIndex, setChunkIndex] = useState(0)

  const mobileReviews = useMemo(
    () => pickRotatingReviewWindow(reviews, chunkIndex, MOBILE_REVIEW_VISIBLE_MAX),
    [reviews, chunkIndex],
  )

  useEffect(() => {
    setChunkIndex(0)
  }, [reviews])

  useEffect(() => {
    if (reviews.length <= MOBILE_REVIEW_VISIBLE_MAX) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const id = window.setInterval(() => {
      setChunkIndex((i) => i + 1)
    }, MOBILE_REVIEW_ROTATE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [reviews.length])

  return { mobileReviews, chunkIndex }
}
