import { describe, expect, it } from 'vitest'
import { formatPublicCardFromPrice } from '@/lib/public-card-from-price'

describe('formatPublicCardFromPrice', () => {
  it('null은 문의, 숫자는 천 단위와 원~', () => {
    expect(formatPublicCardFromPrice(null)).toBe('문의')
    expect(formatPublicCardFromPrice(1234567)).toBe('1,234,567원~')
  })
})
