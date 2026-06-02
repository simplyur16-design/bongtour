import { describe, expect, it } from 'vitest'
import { computeReturnDate } from '@/lib/package-rules'

describe('computeReturnDate', () => {
  it('keeps KST calendar date without UTC -1 drift', () => {
    expect(computeReturnDate('2026-12-12', 3)).toBe('2026-12-14')
  })
})
