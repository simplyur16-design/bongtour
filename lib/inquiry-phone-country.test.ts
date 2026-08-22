import { describe, expect, it } from 'vitest'
import {
  composeInquiryIntlPhone,
  INQUIRY_DEFAULT_PHONE_ISO,
  inquiryPhoneCountryByIso,
} from '@/lib/inquiry-phone-country'

describe('inquiry lang=en country phone', () => {
  it('defaults to Korea +82', () => {
    expect(INQUIRY_DEFAULT_PHONE_ISO).toBe('KR')
    expect(inquiryPhoneCountryByIso('KR').dial).toBe('82')
  })

  it('composes Korean national number without trunk 0', () => {
    expect(composeInquiryIntlPhone('82', '010-1234-5678')).toBe('+821012345678')
  })

  it('composes US local digits with +1', () => {
    expect(composeInquiryIntlPhone('1', '4155552671')).toBe('+14155552671')
  })
})
