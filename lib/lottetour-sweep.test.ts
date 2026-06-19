import { describe, expect, it } from 'vitest'

import { lottetourMonthCountInclusive } from '@/lib/lottetour-price-collect'
import {
  computeLottetourNextPriceRecheckYmd,
  isLottetourPriceRecheckDue,
  mergeLottetourPriceRecheckIntoRawMeta,
} from '@/lib/lottetour-price-recheck-meta'

describe('lottetourMonthCountInclusive', () => {
  it('counts months inclusive within same year span', () => {
    expect(lottetourMonthCountInclusive('2026-06-01', '2026-08-15')).toBe(3)
  })

  it('counts across year boundary up to 36 cap', () => {
    expect(lottetourMonthCountInclusive('2026-11-01', '2027-02-28')).toBe(4)
  })
})

describe('isLottetourPriceRecheckDue', () => {
  it('due when no recheck meta', () => {
    expect(isLottetourPriceRecheckDue(null, '2026-06-20')).toBe(true)
  })

  it('not due before next recheck ymd', () => {
    const rawMeta = mergeLottetourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: '2026-06-25',
      collectSource: 'hxr',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isLottetourPriceRecheckDue(rawMeta, '2026-06-20')).toBe(false)
  })

  it('due on or after next recheck ymd', () => {
    const rawMeta = mergeLottetourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: computeLottetourNextPriceRecheckYmd('2026-06-18'),
      collectSource: 'e2e',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isLottetourPriceRecheckDue(rawMeta, '2026-06-25')).toBe(true)
  })
})
