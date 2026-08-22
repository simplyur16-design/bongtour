import { describe, expect, it } from 'vitest'
import {
  buildInquiryHref,
  parseInquirySearchParams,
  parseInquiryUiLang,
} from '@/lib/inquiry-page'

describe('inquiry lang=en (blog inbound)', () => {
  it('parseInquiryUiLang accepts en and en-*', () => {
    expect(parseInquiryUiLang('en')).toBe('en')
    expect(parseInquiryUiLang('en-US')).toBe('en')
    expect(parseInquiryUiLang('ko')).toBe('ko')
    expect(parseInquiryUiLang(undefined)).toBe('ko')
  })

  it('parseInquirySearchParams reads lang=en from blog URL', () => {
    const q = parseInquirySearchParams({ type: 'travel', lang: 'en' })
    expect(q.uiLang).toBe('en')
  })

  it('buildInquiryHref keeps lang=en when switching types', () => {
    const q = parseInquirySearchParams({ type: 'travel', lang: 'en' })
    expect(buildInquiryHref('travel', q)).toBe('/inquiry?type=travel&lang=en')
    expect(buildInquiryHref('bus', q)).toBe('/inquiry?type=bus&lang=en')
  })
})
