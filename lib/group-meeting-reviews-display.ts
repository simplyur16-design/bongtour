/** 우리끼리·모임여행 후기 공개 노출 상한 — 3열(PC)×3행 */
export const GROUP_MEETING_REVIEWS_DISPLAY_MAX = 9

/** Fisher–Yates 셔플 후 상한만큼 반환 (원본 불변). */
export function sampleReviewsForDisplay<T>(items: readonly T[], max = GROUP_MEETING_REVIEWS_DISPLAY_MAX): T[] {
  const n = items.length
  if (n === 0) return []
  const limit = Math.max(1, max)
  if (n <= limit) return [...items]

  const idx = items.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j]!, idx[i]!]
  }
  return idx.slice(0, limit).map((i) => items[i]!)
}
