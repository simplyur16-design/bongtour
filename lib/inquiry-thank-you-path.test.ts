import { describe, expect, it } from 'vitest'
import {
  INQUIRY_THANK_YOU_PATH,
  buildInquiryThankYouHref,
  normalizeInquiryThankYouKind,
} from '@/lib/inquiry-thank-you-path'

describe('inquiry thank-you path', () => {
  it('stable path for Google Ads conversion URL', () => {
    expect(INQUIRY_THANK_YOU_PATH).toBe('/inquiry/thank-you')
    expect(buildInquiryThankYouHref()).toBe('/inquiry/thank-you')
  })

  it('buildInquiryThankYouHref keeps path prefix and optional query', () => {
    expect(buildInquiryThankYouHref({ kind: 'travel' })).toBe('/inquiry/thank-you?type=travel')
    expect(buildInquiryThankYouHref({ kind: 'bus', delayed: true, contact: 'kakao' })).toBe(
      '/inquiry/thank-you?type=bus&delayed=1&contact=kakao',
    )
    expect(buildInquiryThankYouHref({ from: 'private', kind: 'travel' })).toBe(
      '/inquiry/thank-you?type=travel&from=private',
    )
  })

  it('normalizeInquiryThankYouKind rejects unknown', () => {
    expect(normalizeInquiryThankYouKind('travel')).toBe('travel')
    expect(normalizeInquiryThankYouKind('nope')).toBeNull()
  })
})
