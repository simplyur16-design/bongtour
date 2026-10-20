import { describe, expect, it } from 'vitest'
import { parseProductDepartureYmdFromSearch } from '@/lib/use-product-departure-url-param'

describe('parseProductDepartureYmdFromSearch', () => {
  it('accepts YYYY-MM-DD departure', () => {
    expect(parseProductDepartureYmdFromSearch('?departure=2026-12-04')).toBe('2026-12-04')
    expect(parseProductDepartureYmdFromSearch('departure=2026-12-04&x=1')).toBe('2026-12-04')
  })

  it('rejects invalid values', () => {
    expect(parseProductDepartureYmdFromSearch('')).toBeNull()
    expect(parseProductDepartureYmdFromSearch('?departure=12-04')).toBeNull()
    expect(parseProductDepartureYmdFromSearch('?departure=tomorrow')).toBeNull()
  })
})
