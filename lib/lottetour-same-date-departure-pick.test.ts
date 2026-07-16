import { describe, expect, it } from 'vitest'

import {
  dedupeLottetourDepartureInputsByDate,
  pickLottetourDepartureForSameDate,
} from '@/lib/lottetour-same-date-departure-pick'
import type { DepartureInput } from '@/lib/upsert-product-departures-lottetour'

describe('lottetour same-date departure pick', () => {
  // REGRESSION-FREEZE[lottetour-same-date-origin-evt-priority]
  it('prefers origin evtCd on same departure date (D01A Sep 24)', () => {
    const rows: DepartureInput[] = [
      { departureDate: '2026-09-24', adultPrice: 2299000, supplierPriceKey: 'D01A260924RS004' },
      { departureDate: '2026-09-24', adultPrice: 2499000, supplierPriceKey: 'D01A260924RS003' },
      { departureDate: '2026-09-24', adultPrice: 2299000, supplierPriceKey: 'D01A260924RS002' },
    ]
    const picked = pickLottetourDepartureForSameDate(rows, 'D01A260924RS002')
    expect(picked.supplierPriceKey).toBe('D01A260924RS002')
    expect(picked.adultPrice).toBe(2299000)
  })

  it('falls back to lowest adult price when origin evtCd absent on date', () => {
    const rows: DepartureInput[] = [
      { departureDate: '2026-10-09', adultPrice: 1799000, supplierPriceKey: 'D01A261009RS003' },
      { departureDate: '2026-10-09', adultPrice: 1499000, supplierPriceKey: 'D01A261009RS004' },
    ]
    const picked = pickLottetourDepartureForSameDate(rows, 'D01A260924RS002')
    expect(picked.supplierPriceKey).toBe('D01A261009RS004')
  })

  it('dedupeLottetourDepartureInputsByDate keeps one row per date', () => {
    const out = dedupeLottetourDepartureInputsByDate(
      [
        { departureDate: '2026-09-24', adultPrice: 2299000, supplierPriceKey: 'D01A260924RS004' },
        { departureDate: '2026-09-24', adultPrice: 2299000, supplierPriceKey: 'D01A260924RS002' },
        { departureDate: '2026-09-25', adultPrice: 1499000, supplierPriceKey: 'D01A260925RS002' },
      ],
      'D01A260924RS002',
    )
    expect(out).toHaveLength(2)
    expect(out[0]?.supplierPriceKey).toBe('D01A260924RS002')
  })
})
