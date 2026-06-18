import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  appendBlogProductCtaMarkdown,
  buildProductMarketingCtaAbsoluteUrl,
  buildProductMarketingCtaRelativePath,
} from '@/lib/bong-marketing/cta-url-builder'

describe('buildProductMarketingCtaRelativePath', () => {
  it('builds product slug path with UTM params', () => {
    const path = buildProductMarketingCtaRelativePath({
      slug: 'pkg-mt-0004',
      campaignMonthKey: '2026-06',
      channel: 'naver_blog',
      position: 'final_cta',
    })
    expect(path).toBe(
      '/products/pkg-mt-0004?utm_source=naver_blog&utm_medium=cta&utm_campaign=2026-06-pkg-mt-0004&utm_content=final_cta',
    )
  })

  it('returns home path when slug missing', () => {
    expect(buildProductMarketingCtaRelativePath({ slug: null, campaignMonthKey: '2026-06' })).toBe('/')
    expect(buildProductMarketingCtaRelativePath({ slug: '  ', campaignMonthKey: '2026-06' })).toBe('/')
  })

  it('supports channel-specific utm_source', () => {
    const path = buildProductMarketingCtaRelativePath({
      slug: 'pkg-mt-0004',
      campaignMonthKey: '2026-06',
      channel: 'instagram',
      position: 'mid_cta',
    })
    expect(path).toContain('utm_source=instagram')
    expect(path).toContain('utm_content=mid_cta')
  })

  it('falls back campaign month when monthKey invalid', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00+09:00'))
    const path = buildProductMarketingCtaRelativePath({
      slug: 'pkg-mt-0004',
      campaignMonthKey: 'bad',
      position: 'header_cta',
    })
    expect(path).toContain('utm_campaign=2026-06-pkg-mt-0004')
    expect(path).toContain('utm_content=header_cta')
    vi.useRealTimers()
  })
})

describe('buildProductMarketingCtaAbsoluteUrl', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://bongtour.com'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('returns absolute product URL', () => {
    const url = buildProductMarketingCtaAbsoluteUrl({
      slug: 'pkg-mt-0004',
      campaignMonthKey: '2026-06',
    })
    expect(url).toBe(
      'https://bongtour.com/products/pkg-mt-0004?utm_source=naver_blog&utm_medium=cta&utm_campaign=2026-06-pkg-mt-0004&utm_content=final_cta',
    )
  })

  it('returns site origin when slug missing', () => {
    expect(
      buildProductMarketingCtaAbsoluteUrl({ slug: null, campaignMonthKey: '2026-06' }),
    ).toBe('https://bongtour.com')
  })
})

describe('appendBlogProductCtaMarkdown', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://bongtour.com'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('appends markdown CTA block with absolute link', () => {
    const out = appendBlogProductCtaMarkdown(
      '# 본문',
      '/products/pkg-mt-0004?utm_source=naver_blog&utm_medium=cta&utm_campaign=2026-06-pkg-mt-0004&utm_content=final_cta',
    )
    expect(out).toContain('[**상품 보기**](https://bongtour.com/products/pkg-mt-0004')
    expect(out).toContain('## 상품 보기')
  })
})
