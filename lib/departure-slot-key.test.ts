import { describe, expect, it } from 'vitest'

import {
  computeDepartureSlotKeyFromInput,
  dedupeDepartureInputsBySlotKey,
} from '@/lib/departure-slot-key'
import type { DepartureInput } from '@/lib/upsert-product-departures-lottetour'

describe('departure slot key (lottetour multi-grade)', () => {
  // REGRESSION-FREEZE[lottetour-multi-grade-departure-slots]
  const d01aRows: DepartureInput[] = [
    { departureDate: '2026-09-24', adultPrice: 2299000, supplierPriceKey: 'D01A260924RS002' },
    { departureDate: '2026-09-24', adultPrice: 2499000, supplierPriceKey: 'D01A260924RS003' },
    { departureDate: '2026-09-24', adultPrice: 2299000, supplierPriceKey: 'D01A260924RS004' },
    { departureDate: '2026-09-25', adultPrice: 1499000, supplierPriceKey: 'D01A260925RS002' },
    { departureDate: '2026-10-02', adultPrice: 2199000, supplierPriceKey: 'D01A261002RS004' },
    { departureDate: '2026-10-02', adultPrice: 2199000, supplierPriceKey: 'D01A261002RS005' },
    { departureDate: '2026-10-09', adultPrice: 1799000, supplierPriceKey: 'D01A261009RS003' },
    { departureDate: '2026-10-09', adultPrice: 1499000, supplierPriceKey: 'D01A261009RS004' },
  ]

  it('assigns distinct slot keys per evtCd on same calendar date', () => {
    const keys = d01aRows.map((r) => computeDepartureSlotKeyFromInput(r))
    expect(new Set(keys).size).toBe(8)
    expect(keys).toContain('D01A260924RS002')
    expect(keys).toContain('D01A261009RS004')
  })

  it('dedupeDepartureInputsBySlotKey keeps all 8 D01A calendar rows', () => {
    const out = dedupeDepartureInputsBySlotKey(d01aRows)
    expect(out).toHaveLength(8)
  })

  it('falls back to YMD when no supplier price key', () => {
    expect(computeDepartureSlotKeyFromInput({ departureDate: '2026-07-01' })).toBe('2026-07-01')
  })
})
