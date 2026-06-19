import { describe, expect, it } from 'vitest'
import {
  computeModetourNextPriceRecheckYmd,
  isModetourPriceRecheckDue,
  mergeModetourPriceRecheckIntoRawMeta,
  MODETOUR_HORIZON_RECHECK_DAYS,
  MODETOUR_LAST_PRICE_COLLECT_SOURCE_KEY,
  MODETOUR_NEXT_PRICE_RECHECK_YMD_KEY,
  parseModetourLastPriceCollectSource,
  parseModetourNextPriceRecheckYmd,
} from '@/lib/modetour-price-recheck-meta'

describe('modetour-price-recheck-meta', () => {
  it('schedules next recheck 7 days after today', () => {
    expect(computeModetourNextPriceRecheckYmd('2026-06-16')).toBe('2026-06-23')
    expect(MODETOUR_HORIZON_RECHECK_DAYS).toBe(7)
  })

  it('parses and merges recheck rawMeta keys', () => {
    const rawMeta = mergeModetourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: '2026-06-23',
      collectSource: 'e2e',
      horizonVerifiedAtIso: '2026-06-16T00:00:00.000Z',
    })
    const parsed = JSON.parse(rawMeta) as Record<string, unknown>
    expect(parsed[MODETOUR_NEXT_PRICE_RECHECK_YMD_KEY]).toBe('2026-06-23')
    expect(parsed[MODETOUR_LAST_PRICE_COLLECT_SOURCE_KEY]).toBe('e2e')
    expect(parseModetourNextPriceRecheckYmd(rawMeta)).toBe('2026-06-23')
    expect(parseModetourLastPriceCollectSource(rawMeta)).toBe('e2e')
  })

  it('isModetourPriceRecheckDue — future recheck skips sweep', () => {
    const rawMeta = mergeModetourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: '2026-06-30',
      collectSource: 'api',
      horizonVerifiedAtIso: '2026-06-16T00:00:00.000Z',
    })
    expect(isModetourPriceRecheckDue(rawMeta, '2026-06-16')).toBe(false)
    expect(isModetourPriceRecheckDue(rawMeta, '2026-06-30')).toBe(true)
    expect(isModetourPriceRecheckDue(null, '2026-06-16')).toBe(true)
  })
})
