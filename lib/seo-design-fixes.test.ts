import { describe, expect, it } from 'vitest'
import { kakaoConsultHref } from '@/lib/kakao-consult-href'
import { buildProductsBrowseMetadata } from '@/lib/products-browse-metadata'
import { buildTouristTripJsonLd } from '@/lib/seo/product-json-ld'
import {
  SITEMAP_ESIM_HELP_PATHS,
  buildPublicSitemapEntries,
} from '@/lib/sitemap-public-entries'

describe('seo-design-public-fixes', () => {
  // REGRESSION-FREEZE[seo-design-public-fixes]: sitemap lastmod는 상품 updatedAt — manifest
  it('uses the newest product updatedAt for static urls and lists esim help', () => {
    const older = new Date('2026-01-02T00:00:00.000Z')
    const newer = new Date('2026-06-03T00:00:00.000Z')
    const entries = buildPublicSitemapEntries({
      origin: 'https://bongtour.com',
      products: [{ id: 'p1', slug: 'pkg-hn-0001', updatedAt: older }],
      trainingPrograms: [{ id: 't1', slug: 'train-1', updatedAt: newer }],
    })
    const home = entries.find((entry) => entry.url === 'https://bongtour.com/')
    const help = entries.find((entry) => entry.url === 'https://bongtour.com/travel/esim/help/setup-guide')
    const product = entries.find((entry) => entry.url === 'https://bongtour.com/products/pkg-hn-0001')
    expect(home?.lastModified).toEqual(newer)
    expect(help?.lastModified).toEqual(newer)
    expect(product?.lastModified).toEqual(older)
    for (const path of SITEMAP_ESIM_HELP_PATHS) {
      expect(entries.some((entry) => entry.url === `https://bongtour.com${path}`)).toBe(true)
    }
    const empty = buildPublicSitemapEntries({ origin: 'https://bongtour.com', products: [], trainingPrograms: [] })
    expect(empty[0]?.lastModified).toBeUndefined()
  })

  it('products browse title is absolute and twitter has an image', () => {
    const meta = buildProductsBrowseMetadata('봉투어')
    expect(meta.title).toEqual({ absolute: '여행 상품 목록 | 봉투어' })
    expect(meta.twitter?.images).toEqual(['/og/default.webp'])
    expect(meta.openGraph?.images).toEqual([{ url: '/og/default.webp', alt: '봉투어' }])
  })

  it('TouristTrip json-ld has itinerary and no price fields', () => {
    const data = buildTouristTripJsonLd({
      name: '홍콩',
      description: '일정',
      url: 'https://bongtour.com/products/pkg-hn-0001',
      itinerary: [{ dayNumber: 1, title: '시내', city: '홍콩' }],
    })
    expect(data['@type']).toBe('TouristTrip')
    expect(data).not.toHaveProperty('offers')
    expect(JSON.stringify(data)).not.toMatch(/price|lowPrice|highPrice|KRW/i)
  })

  it('kakao detail link keeps the chat url and adds product code and title', () => {
    const href = kakaoConsultHref('https://pf.kakao.com/_xlxjrxlX/chat', {
      productCode: 'pkg-hn-0001',
      productTitle: '홍콩 3박',
    })
    const url = new URL(href)
    expect(url.origin + url.pathname).toBe('https://pf.kakao.com/_xlxjrxlX/chat')
    expect(url.searchParams.get('productCode')).toBe('pkg-hn-0001')
    expect(url.searchParams.get('productTitle')).toBe('홍콩 3박')
    expect(kakaoConsultHref('https://pf.kakao.com/_xlxjrxlX/chat')).toBe('https://pf.kakao.com/_xlxjrxlX/chat')
  })
})
