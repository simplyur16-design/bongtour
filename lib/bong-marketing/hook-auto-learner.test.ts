import { describe, it, expect } from 'vitest'
import {
  computePercentileSliceCount,
  extractHeadlineFromCaption,
} from '@/lib/bong-marketing/hook-auto-learner'

describe('hook-auto-learner', () => {
  it('extractHeadlineFromCaption picks first valid line', () => {
    expect(extractHeadlineFromCaption('#봉투어\n다낭 3박 4일, 이렇게 쉬었어요')).toBe(
      '다낭 3박 4일, 이렇게 쉬었어요',
    )
  })

  it('rejects too short lines', () => {
    expect(extractHeadlineFromCaption('짧음\n다낭 여행은 이렇게 준비하면 편해요')).toBe(
      '다낭 여행은 이렇게 준비하면 편해요',
    )
  })

  it('rejects hashtag-only lines', () => {
    expect(extractHeadlineFromCaption('#봉투어 #여행\n#해시태그만')).toBeNull()
  })

  it('computePercentileSliceCount floors at 1', () => {
    expect(computePercentileSliceCount(10, 20)).toBe(2)
    expect(computePercentileSliceCount(3, 20)).toBe(1)
  })
})
