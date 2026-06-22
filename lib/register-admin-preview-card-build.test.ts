import { describe, expect, it } from 'vitest'
import {
  formatRegisterOptionalTourPrice,
  normalizeRegisterOptionalTourCurrency,
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
})
