import { describe, expect, it } from 'vitest'
import {
  computeYbtourNextPriceRecheckYmd,
  isYbtourPriceRecheckDue,
  mergeYbtourPriceRecheckIntoRawMeta,
} from '@/lib/ybtour-price-recheck-meta'

describe('isYbtourPriceRecheckDue', () => {
  it('due when no recheck meta', () => {
    expect(isYbtourPriceRecheckDue(null, '2026-06-20')).toBe(true)
  })

  it('not due before next recheck ymd', () => {
    const rawMeta = mergeYbtourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: '2026-06-25',
      collectSource: 'api',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isYbtourPriceRecheckDue(rawMeta, '2026-06-20')).toBe(false)
  })

  it('due on or after next recheck ymd', () => {
    const rawMeta = mergeYbtourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: computeYbtourNextPriceRecheckYmd('2026-06-18'),
      collectSource: 'e2e',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isYbtourPriceRecheckDue(rawMeta, '2026-06-25')).toBe(true)
  })
})
