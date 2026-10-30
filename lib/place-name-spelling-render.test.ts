import { describe, expect, it } from 'vitest'
import type { ProductPublicDetailRenderModel } from '@/lib/product-public-detail/types'
import { normalizeProductPublicDetailModelPlaceNames } from '@/lib/place-name-spelling-render'

/** REGRESSION-FREEZE[place-name-spelling-n1]: 출력 시점 교정 — 입력(캐시/저장값) 객체 불변 — manifest */
function model(): ProductPublicDetailRenderModel {
  return {
    variant: 'air-hotel',
    viewProduct: {
      title: '벳부·유후인 3일',
      highlightPointsRaw: '큐슈 온천',
      priceFrom: 1290000,
      schedule: [{ day: 1, title: '마츠야마 도착', description: '도고온천', hotelText: '츠카사' }],
      itineraries: [{ day: 1, description: '비엔티엔 시내' }],
      hotelNames: ['노보텔 푸꼽옥'],
    },
    seo: { productDescription: '이태리 일주', breadcrumbItems: [{ name: '큐슈', url: '/x' }], itinerary: [{ dayNumber: 1, title: '벳부', city: '큐슈' }] },
    masterArg: {
      title: '벳부 추천일정',
      summary: '큐슈',
      days: [{ title: 'Day1', summary: '벳부', activities: [{ title: '벳부 지옥', description: '', location: '벳부', estimatedCostKrw: 3000, estimatedCostNote: '벳부 입장료' }] }],
    },
  } as unknown as ProductPublicDetailRenderModel
}

describe('normalizeProductPublicDetailModelPlaceNames', () => {
  it('normalizes display text, keeps input untouched and numbers/cost notes as-is', () => {
    const input = model()
    const snapshot = JSON.stringify(input)
    const out = normalizeProductPublicDetailModelPlaceNames(input) as unknown as Record<string, any>
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(out.viewProduct.title).toBe('벳푸·유후인 3일')
    expect(out.viewProduct.highlightPointsRaw).toBe('규슈 온천')
    expect(out.viewProduct.priceFrom).toBe(1290000)
    expect(out.viewProduct.schedule[0].title).toBe('마쓰야마 도착')
    expect(out.viewProduct.schedule[0].hotelText).toBe('츠카사')
    expect(out.viewProduct.itineraries[0].description).toBe('비엔티안 시내')
    expect(out.viewProduct.hotelNames[0]).toBe('노보텔 푸꾸옥')
    expect(out.seo.productDescription).toBe('이탈리아 일주')
    expect(out.seo.breadcrumbItems[0]).toEqual({ name: '규슈', url: '/x' })
    expect(out.seo.itinerary[0]).toEqual({ dayNumber: 1, title: '벳푸', city: '규슈' })
    expect(out.masterArg.days[0].activities[0]).toMatchObject({ title: '벳푸 지옥', location: '벳푸', estimatedCostKrw: 3000, estimatedCostNote: '벳부 입장료' })
  })
  it('returns same reference when nothing to fix', () => {
    const m = { variant: 'package', viewProduct: { title: '오사카 3일', schedule: [] }, seo: { productDescription: 'x', breadcrumbItems: [] } } as unknown as ProductPublicDetailRenderModel
    expect(normalizeProductPublicDetailModelPlaceNames(m)).toBe(m)
  })
})
