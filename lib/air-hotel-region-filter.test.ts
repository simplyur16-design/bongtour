import { describe, expect, it } from 'vitest'
import {
  buildAirHotelRegionChips,
  isAirHotelRegionBucketParam,
  resolveAirHotelItemBucket,
} from '@/lib/air-hotel-region-filter'

describe('air-hotel-region-filter', () => {
  it('accepts mega-menu bucket ids only', () => {
    expect(isAirHotelRegionBucketParam('japan')).toBe(true)
    expect(isAirHotelRegionBucketParam('china_hk_mo')).toBe(true)
    expect(isAirHotelRegionBucketParam('guam')).toBe(false)
  })

  it('aggregates items by overseas bucket in menu order', () => {
    const chips = buildAirHotelRegionChips([
      { overseasBucket: 'japan' },
      { overseasBucket: 'japan' },
      { overseasBucket: 'china_hk_mo' },
      { overseasBucket: undefined },
    ])
    expect(chips.map((c) => c.id)).toEqual(['japan', 'china_hk_mo', 'other'])
    expect(chips.find((c) => c.id === 'japan')?.count).toBe(2)
  })

  it('defaults missing bucket to other', () => {
    expect(resolveAirHotelItemBucket(null)).toBe('other')
  })
})
