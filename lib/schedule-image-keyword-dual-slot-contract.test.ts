/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — vitest 래퍼 (SSOT: schedule-image-keyword-dual-slot-contract.ts)
 */
import { describe, expect, it } from 'vitest'
import { runScheduleImageKeywordDualSlotContract } from '@/lib/schedule-image-keyword-dual-slot-contract'

describe('REGRESSION-FREEZE schedule-image-keyword-dual-slot — all suppliers', () => {
  it('passes shared 6-supplier dual-slot contract', () => {
    const failures = runScheduleImageKeywordDualSlotContract()
    expect(failures, failures.join('\n')).toEqual([])
  })
})
