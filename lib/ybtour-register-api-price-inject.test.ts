import { describe, expect, it } from 'vitest'
import { dedupeYbtourProductPriceCreateRows } from '@/lib/ybtour-register-api-price-inject'

describe('dedupeYbtourProductPriceCreateRows', () => {
  it('keeps first row per departure date', () => {
    const d1 = new Date('2026-07-01T00:00:00.000Z')
    const d2 = new Date('2026-07-02T00:00:00.000Z')
    const rows = dedupeYbtourProductPriceCreateRows([
      { date: d1, adult: 100 },
      { date: d1, adult: 200 },
      { date: d2, adult: 300 },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.adult).toBe(100)
    expect(rows[1]?.adult).toBe(300)
  })
})
