import { describe, expect, it } from 'vitest'
import { registerPrePhotoIssuesNeedLaneRematerialize } from '@/lib/register-pre-photo-lane-rematerialize'

describe('registerPrePhotoIssuesNeedLaneRematerialize', () => {
  // REGRESSION-FREEZE[register-pre-photo-lane-rematerialize]: FIT·패키지 remat 대상 이슈 — manifest
  it('중간일 공란·자유일정 추천일정 누락·FIT 공란을 잡는다', () => {
    expect(registerPrePhotoIssuesNeedLaneRematerialize(['day2_middle_keyword_empty'])).toBe(true)
    expect(registerPrePhotoIssuesNeedLaneRematerialize(['day3_free_recommended_itinerary_missing'])).toBe(
      true,
    )
    expect(registerPrePhotoIssuesNeedLaneRematerialize(['fit_keyword_empty'])).toBe(true)
    expect(registerPrePhotoIssuesNeedLaneRematerialize(['theme_tag_missing'])).toBe(false)
  })
})
