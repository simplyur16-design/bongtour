import { describe, expect, it } from 'vitest'
import { inquiryFormMeta, inquiryKindLabel, inquiryShellCopy } from '@/lib/inquiry-form-i18n'
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

describe('inquiry lang=en Korean-first copy', () => {
  it('keeps Korean title/description and puts English on separate fields', () => {
    const m = inquiryFormMeta('travel', 'en')
    expect(m.title).toBe('여행 상담·예약 신청')
    expect(m.title).not.toMatch(/ \/ /)
    expect(m.description).toContain('일정·인원·지역')
    expect(m.description).not.toMatch(/Leave dates/)
    expect(m.titleEn).toBe('Travel consultation request')
    expect(m.descriptionEn).toMatch(/Leave dates/)
  })

  it('type help is Korean then English, not slash-joined', () => {
    const copy = inquiryShellCopy('en')
    expect(copy.typeHelp).toMatch(/^문의 유형을 선택해 주세요/)
    expect(copy.typeHelp).not.toMatch(/ \/ /)
    expect(copy.typeHelpEn).toMatch(/inquiry type/i)
    expect(copy).not.toHaveProperty('currentType')
  })

  it('kind chips stay Korean-only', () => {
    expect(inquiryKindLabel('travel', 'en')).toBe('여행 상담')
    expect(inquiryKindLabel('travel', 'en')).not.toMatch(/Travel/)
  })

  it('thank-you lines are Korean block then English block', () => {
    const copy = inquiryShellCopy('en')
    expect(copy.thankYouLinesKo?.[0]).toMatch(/상담/)
    expect(copy.thankYouLinesEn?.[0]).toMatch(/Dates/)
  })
})
