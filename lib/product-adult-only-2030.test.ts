/**
 * REGRESSION-FREEZE[product-adult-only-2030]
 */
import { describe, expect, it } from 'vitest'
import {
  isHanatour2030ProductTitle,
  isProductAdultOnly2030,
  stripAdultOnly2030PriceRows,
} from '@/lib/product-adult-only-2030'

describe('product-adult-only-2030', () => {
  it('detects by title markers and sportsThemeTag', () => {
    expect(isHanatour2030ProductTitle('규슈 3일 투어 Light #또래 친구 만들기')).toBe(true)
    expect(isProductAdultOnly2030({ title: '방콕 3일 (2030)' })).toBe(true)
    expect(isProductAdultOnly2030({ title: '방콕 3일', sportsThemeTag: ['2030'] })).toBe(true)
    expect(isProductAdultOnly2030({ title: '방콕 3일', sportsThemeTag: ['golf'] })).toBe(false)
  })

  it('strips child/infant slots from public price rows', () => {
    const out = stripAdultOnly2030PriceRows([
      {
        adult: 1_000_000,
        childBed: 900_000,
        childNoBed: 800_000,
        infant: 100_000,
        priceAdult: 1_000_000,
        priceChildWithBed: 900_000,
        priceChildNoBed: 800_000,
        priceInfant: 100_000,
      },
    ])
    expect(out[0]?.childBed).toBeNull()
    expect(out[0]?.infant).toBeNull()
    expect(out[0]?.priceChildWithBed).toBeNull()
    expect(out[0]?.priceInfant).toBeNull()
    expect(out[0]?.adult).toBe(1_000_000)
  })
})
