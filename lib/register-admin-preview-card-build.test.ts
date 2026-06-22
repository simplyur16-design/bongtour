import { describe, expect, it } from 'vitest'
import {
  formatRegisterOptionalTourPrice,
  normalizeRegisterOptionalTourCurrency,
  buildRegisterAdminPreviewCardData,
} from '@/lib/register-admin-preview-card-build'

describe('register-admin-preview-card-build currency', () => {
  it('CAD는 원화로 접히지 않음', () => {
    expect(normalizeRegisterOptionalTourCurrency('CAD')).toBe('CAD')
    expect(formatRegisterOptionalTourPrice(100, 'CAD')).toBe('CAD 100')
    expect(formatRegisterOptionalTourPrice(90, 'CAD')).toBe('CAD 90')
  })

  it('KRW는 원 표기', () => {
    expect(formatRegisterOptionalTourPrice(100, 'KRW')).toBe('100원')
  })

  it('쇼핑 횟수만 있을 때 미리보기 1행', () => {
    const card = buildRegisterAdminPreviewCardData({
      parsed: { shoppingVisitCount: 5, shoppingStops: null },
      productDraft: { title: 't', duration: '5일', priceFrom: 0 },
      schedule: [],
      originalBodyText: '',
      fieldIssues: [],
    })
    expect(card.shoppingItems.length).toBe(1)
    expect(card.shoppingItems[0]?.itemName).toContain('5')
  })
})
