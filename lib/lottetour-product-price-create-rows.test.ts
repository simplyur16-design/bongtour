import { describe, expect, it } from 'vitest'

import { dedupeLottetourProductPriceCreateRows } from '@/lib/lottetour-product-price-create-rows'

describe('dedupeLottetourProductPriceCreateRows', () => {
  it('keeps first row per YMD', () => {
    const rows = dedupeLottetourProductPriceCreateRows([
      { date: new Date('2026-07-01T00:00:00.000Z'), adult: 100 },
      { date: new Date('2026-07-01T12:00:00.000Z'), adult: 200 },
      { date: new Date('2026-07-02T00:00:00.000Z'), adult: 300 },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.adult).toBe(100)
    expect(rows[1]?.adult).toBe(300)
  })
})
