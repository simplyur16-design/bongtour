import { describe, expect, it } from 'vitest'

import {
  computeVerygoodtourNextPriceRecheckYmd,
  isVerygoodtourPriceRecheckDue,
  mergeVerygoodtourPriceRecheckIntoRawMeta,
} from '@/lib/verygoodtour-price-recheck-meta'

describe('isVerygoodtourPriceRecheckDue', () => {
  it('due when no recheck meta', () => {
    expect(isVerygoodtourPriceRecheckDue(null, '2026-06-20')).toBe(true)
  })

  it('not due before next recheck ymd', () => {
    const rawMeta = mergeVerygoodtourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: '2026-06-25',
      collectSource: 'hxr',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isVerygoodtourPriceRecheckDue(rawMeta, '2026-06-20')).toBe(false)
  })

  it('due on or after next recheck ymd', () => {
    const rawMeta = mergeVerygoodtourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: computeVerygoodtourNextPriceRecheckYmd('2026-06-18'),
      collectSource: 'e2e',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isVerygoodtourPriceRecheckDue(rawMeta, '2026-06-25')).toBe(true)
  })
})
