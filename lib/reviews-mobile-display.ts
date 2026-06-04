import type { ReviewCardModel } from '@/lib/reviews-types'

/** 모바일 후기 그리드 — 한 화면 최대 노출 수(2×4) */
export const MOBILE_REVIEW_VISIBLE_MAX = 8

/** 모바일 후기 묶음 교체 간격(ms) — 10분 */
export const MOBILE_REVIEW_ROTATE_INTERVAL_MS = 10 * 60 * 1000

/** 순환 윈도우: chunkIndex마다 연속 8건(끝에서 이어서) */
export function pickRotatingReviewWindow(
  reviews: readonly ReviewCardModel[],
  chunkIndex: number,
  size = MOBILE_REVIEW_VISIBLE_MAX,
): ReviewCardModel[] {
  const n = reviews.length
  if (n === 0) return []
  if (n <= size) return [...reviews]
  const start = (chunkIndex * size) % n
  const out: ReviewCardModel[] = []
  for (let i = 0; i < size; i++) {
    out.push(reviews[(start + i) % n]!)
  }
  return out
}
