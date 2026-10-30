import { describe, expect, it } from 'vitest'
import {
  PRODUCT_CARD_IMAGE_OBJECT_POSITION,
  productCardImageObjectPosition,
  productCardImageObjectPositionStyle,
} from './product-card-image-position'

describe('product card image object-position', () => {
  it('covers exactly the 6 flagged products', () => {
    expect(Object.keys(PRODUCT_CARD_IMAGE_OBJECT_POSITION).sort()).toEqual(
      ['fim-yb-0003', 'fit-hn-0035', 'fit-hn-0047', 'fit-mt-0028', 'fit-nl-0004', 'fit-nl-0009'].sort(),
    )
  })
  it('returns the configured position', () => {
    expect(productCardImageObjectPosition('fit-mt-0028')).toBe('15% 50%')
    expect(productCardImageObjectPosition('fit-hn-0035')).toBe('80% 50%')
    expect(productCardImageObjectPosition(' FIT-NL-0009 ')).toBe('65% 50%')
    expect(productCardImageObjectPositionStyle('fit-hn-0047')).toEqual({ objectPosition: '70% 50%' })
  })
  it('keeps default (no style) for other or missing slugs', () => {
    expect(productCardImageObjectPosition('fit-hn-0013')).toBeNull()
    expect(productCardImageObjectPosition(null)).toBeNull()
    expect(productCardImageObjectPosition('')).toBeNull()
    expect(productCardImageObjectPositionStyle(undefined)).toBeUndefined()
  })
  it('all values are valid "x% y%"', () => {
    for (const v of Object.values(PRODUCT_CARD_IMAGE_OBJECT_POSITION)) expect(v).toMatch(/^\d{1,3}% \d{1,3}%$/)
  })
})
