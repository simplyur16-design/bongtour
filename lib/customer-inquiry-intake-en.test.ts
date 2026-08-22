import { describe, expect, it } from 'vitest'
import { validateCustomerInquiryBody } from '@/lib/customer-inquiry-intake'

function travelBody(over: Record<string, unknown> = {}) {
  return {
    inquiryType: 'travel_consult',
    applicantName: 'Jane Wilson',
    applicantPhone: '010-1234-5678',
    applicantEmail: 'jane@example.com',
    message: 'We would like a family trip to Osaka in October.',
    privacyAgreed: true,
    privacyNoticeVersion: 'training-inquiry-v1',
    privacyNoticeConfirmedAt: new Date().toISOString(),
    ...over,
  }
}

describe('inquiry lang=en intake', () => {
  it('Korean production rules still treat English-only message as silent_bot', () => {
    const r = validateCustomerInquiryBody(travelBody(), { productionInquiryRules: true })
    expect(r.ok).toBe('silent_bot')
  })

  it('accepts English travel consult with international phone when inquiryUiLang=en', () => {
    const r = validateCustomerInquiryBody(
      travelBody({
        inquiryUiLang: 'en',
        applicantPhone: '+1 415 555 2671',
      }),
      { productionInquiryRules: true },
    )
    expect(r.ok).toBe(true)
    if (r.ok === true) {
      expect(r.value.applicantName).toBe('Jane Wilson')
      expect(r.value.applicantPhone).toContain('415')
    }
  })
})
