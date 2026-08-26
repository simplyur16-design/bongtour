import { describe, expect, it } from 'vitest'

import { shouldSkipImmediateDrainRetryOnSaturatedTimeout } from '@/lib/bongsim/db/pool'

// REGRESSION-FREEZE[bongsim-fulfill-drain-saturated-retry]: saturated → no immediate retry — manifest

describe('shouldSkipImmediateDrainRetryOnSaturatedTimeout', () => {
  it('skips the same-tick drain retry when the pool is saturated', () => {
    expect(shouldSkipImmediateDrainRetryOnSaturatedTimeout(true)).toBe(true)
  })

  it('allows heal-then-retry when not saturated', () => {
    expect(shouldSkipImmediateDrainRetryOnSaturatedTimeout(false)).toBe(false)
  })
})
