/**
 * REGRESSION-FREEZE[kyowontour-register-highlight-corepoints]: corePoints → highlight — manifest
 */
import { describe, expect, it } from 'vitest'
import { formatKyowontourHighlightPointsFromCorePoints } from '@/lib/extract-highlight-kyowontour'

describe('formatKyowontourHighlightPointsFromCorePoints', () => {
  it('keeps product core points and drops insurance/visa/ops', () => {
    const out = formatKyowontourHighlightPointsFromCorePoints([
      { title: '여강 고성 야경', body: '여강 고성에서 바라보는 야경' },
      { title: '여행자 보험', body: '여행자보험 가입' },
      { title: '비자 안내', body: '무비자 입국' },
      { title: '예약안내', body: '예약 시 확인 사항' },
      { title: '호텔', body: '4성급 호텔 숙박' },
    ])
    expect(out).toMatch(/여강 고성/)
    expect(out).toMatch(/4성급 호텔/)
    expect(out).not.toMatch(/보험/)
    expect(out).not.toMatch(/비자/)
    expect(out).not.toMatch(/예약 시/)
  })
})
