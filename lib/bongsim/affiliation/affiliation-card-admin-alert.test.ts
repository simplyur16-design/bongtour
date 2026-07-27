import { afterEach, describe, expect, it } from 'vitest'
import { buildAffiliationCardAdminAlertSms } from '@/lib/bongsim/affiliation/affiliation-card-service'

// REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: affiliation card admin SMS link — manifest

describe('buildAffiliationCardAdminAlertSms', () => {
  const prevSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

  afterEach(() => {
    if (prevSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = prevSiteUrl
  })

  it('puts absolute admin URL on its own line right after the header', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.bongtour.com'
    const text = buildAffiliationCardAdminAlertSms({
      who: '홍길동',
      company: '경기도의회',
    })
    const lines = text.split('\n')
    expect(lines[0]).toBe('[봉투어] 명함 승인요청')
    expect(lines[1]).toBe('https://www.bongtour.com/admin/bongsim/affiliation-cards')
    expect(lines[2]).toBe('홍길동 · 경기도의회')
    expect(text).not.toContain('\n/admin/')
  })

  it('truncates long submitter labels without pushing URL to the end', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.bongtour.com'
    const text = buildAffiliationCardAdminAlertSms({
      who: '아주아주아주아주아주긴이름입니다',
      company: '아주아주아주아주아주긴회사명입니다',
    })
    expect(text.split('\n')[1]).toMatch(/^https:\/\//)
    expect(text.split('\n')[2]?.length).toBeLessThanOrEqual(51)
  })
})
