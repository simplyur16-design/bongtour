import { describe, expect, it } from 'vitest'
import { formatStoredMoneyLabel, getPackageOptionalTourRowsFromProduct } from '@/lib/optional-tours-ui-model'

describe('formatStoredMoneyLabel', () => {
  it('원화만 원, 외화는 코드, 통화 없으면 숫자만', () => {
    expect(formatStoredMoneyLabel(20, 'KRW')).toBe('20원')
    expect(formatStoredMoneyLabel(15, 'USD')).toBe('USD 15')
    expect(formatStoredMoneyLabel(30, null)).toBe('30')
    expect(formatStoredMoneyLabel(30, null)).not.toMatch(/원|₩/)
  })

  it('레거시 옵션에 통화가 없으면 ₩나 원을 붙이지 않는다', () => {
    const rows = getPackageOptionalTourRowsFromProduct(
      JSON.stringify([{ name: '시내 투어', priceValue: 25, currency: 'USD' }]),
      null,
    )
    expect(rows[0]?.priceDisplay).toBe('성인 USD 25')
    expect(rows[0]?.priceDisplay).not.toMatch(/₩|원/)
  })
})
