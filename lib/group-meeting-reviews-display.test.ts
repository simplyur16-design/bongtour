import { describe, expect, it } from 'vitest'
import {
  GROUP_MEETING_REVIEWS_DISPLAY_MAX,
  sampleReviewsForDisplay,
} from '@/lib/group-meeting-reviews-display'

describe('sampleReviewsForDisplay', () => {
  it('returns at most GROUP_MEETING_REVIEWS_DISPLAY_MAX items', () => {
    const pool = Array.from({ length: 30 }, (_, i) => ({ id: String(i) }))
    const out = sampleReviewsForDisplay(pool)
    expect(out).toHaveLength(GROUP_MEETING_REVIEWS_DISPLAY_MAX)
    expect(new Set(out.map((x) => x.id)).size).toBe(GROUP_MEETING_REVIEWS_DISPLAY_MAX)
  })

  it('returns all when pool is smaller than limit', () => {
    const pool = [{ id: 'a' }, { id: 'b' }]
    expect(sampleReviewsForDisplay(pool)).toEqual(pool)
  })
})
