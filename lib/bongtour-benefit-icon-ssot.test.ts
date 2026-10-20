import { describe, expect, it } from 'vitest'
import {
  benefitIconKeyForTransportLabel,
  inferBongtourBenefitIconKeys,
} from '@/lib/bongtour-benefit-icon-ssot'

describe('inferBongtourBenefitIconKeys', () => {
  it('picks 직항·국내선·노쇼핑 from haystack', () => {
    const keys = inferBongtourBenefitIconKeys('직항 다낭 5일 #노쇼핑 #노옵션 국내선 이동')
    expect(keys).toContain('direct_flight')
    expect(keys).toContain('domestic_flight')
    expect(keys).toContain('no_shopping')
    expect(keys).toContain('no_option')
  })
})

describe('benefitIconKeyForTransportLabel', () => {
  it('maps transport labels', () => {
    expect(benefitIconKeyForTransportLabel('직항')).toBe('direct_flight')
    expect(benefitIconKeyForTransportLabel('국내선 이동')).toBe('domestic_flight')
    expect(benefitIconKeyForTransportLabel('대형버스')).toBe('coach')
    expect(benefitIconKeyForTransportLabel('국제선')).toBe('international_flight')
  })
})
