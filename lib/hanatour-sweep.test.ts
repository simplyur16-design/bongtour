import { describe, expect, it } from 'vitest'
import {
  computeHanatourNextPriceRecheckYmd,
  isHanatourPriceRecheckDue,
  mergeHanatourPriceRecheckIntoRawMeta,
} from '@/lib/hanatour-price-recheck-meta'

describe('isHanatourPriceRecheckDue', () => {
  it('due when no recheck meta', () => {
    expect(isHanatourPriceRecheckDue(null, '2026-06-20')).toBe(true)
  })

  it('not due before next recheck ymd', () => {
    const rawMeta = mergeHanatourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: '2026-06-25',
      collectSource: 'api',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isHanatourPriceRecheckDue(rawMeta, '2026-06-20')).toBe(false)
  })

  it('due on or after next recheck ymd', () => {
    const rawMeta = mergeHanatourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: computeHanatourNextPriceRecheckYmd('2026-06-18'),
      collectSource: 'api',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isHanatourPriceRecheckDue(rawMeta, '2026-06-25')).toBe(true)
  })
})
