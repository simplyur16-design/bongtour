import { describe, expect, it } from 'vitest'
import type { ProductPublicDetailRenderModel } from '@/lib/product-public-detail/types'
import { normalizeProductPublicDetailModelPlaceNames } from '@/lib/place-name-spelling-render'

/** REGRESSION-FREEZE[place-name-spelling-n1]: 출력 시점 교정 — 입력(캐시/저장값) 객체 불변 — manifest */
function model(): ProductPublicDetailRenderModel {
  return {
    variant: 'air-hotel',
    viewProduct: {
      title: '푸꾸욱·유후인 3일',
      highlightPointsRaw: '냐짱 온천',
      priceFrom: 1290000,
      schedule: [{ day: 1, title: '호찌민 도착', description: '도고온천', hotelText: '츠카사' }],
      itineraries: [{ day: 1, description: '푸껫 시내' }],
      hotelNames: ['노보텔 푸꼽옥'],
    },
    seo: { productDescription: '이태리 일주', breadcrumbItems: [{ name: '하와리', url: '/x' }], itinerary: [{ dayNumber: 1, title: '효도협', city: '하와리' }] },
    masterArg: {
      title: '푸꾸욱 추천일정',
      summary: '냐짱',
      days: [{ title: 'Day1', summary: '효도협', activities: [{ title: '효도협 트레킹', description: '', location: '효도협', estimatedCostKrw: 3000, estimatedCostNote: '효도협 입장료' }] }],
    },
  } as unknown as ProductPublicDetailRenderModel
}

describe('normalizeProductPublicDetailModelPlaceNames', () => {
  it('normalizes display text, keeps input untouched and numbers/cost notes as-is', () => {
    const input = model()
    const snapshot = JSON.stringify(input)
    const out = normalizeProductPublicDetailModelPlaceNames(input) as unknown as Record<string, any>
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(out.viewProduct.title).toBe('푸꾸옥·유후인 3일')
    expect(out.viewProduct.highlightPointsRaw).toBe('나트랑 온천')
    expect(out.viewProduct.priceFrom).toBe(1290000)
    expect(out.viewProduct.schedule[0].title).toBe('호치민 도착')
    expect(out.viewProduct.schedule[0].hotelText).toBe('츠카사')
    expect(out.viewProduct.itineraries[0].description).toBe('푸켓 시내')
    expect(out.viewProduct.hotelNames[0]).toBe('노보텔 푸꾸옥')
    expect(out.seo.productDescription).toBe('이탈리아 일주')
    expect(out.seo.breadcrumbItems[0]).toEqual({ name: '하와이', url: '/x' })
    expect(out.seo.itinerary[0]).toEqual({ dayNumber: 1, title: '호도협', city: '하와이' })
    expect(out.masterArg.days[0].activities[0]).toMatchObject({ title: '호도협 트레킹', location: '호도협', estimatedCostKrw: 3000, estimatedCostNote: '효도협 입장료' })
  })
  it('common names (나트랑·푸켓·호치민·벳부·큐슈) pass through unchanged', () => {
    const m = { variant: 'package', viewProduct: { title: '나트랑 푸켓 호치민 벳부 큐슈 마츠야마', schedule: [] }, seo: { productDescription: '타이페이', breadcrumbItems: [] } } as unknown as ProductPublicDetailRenderModel
    expect(normalizeProductPublicDetailModelPlaceNames(m)).toBe(m)
  })
  it('returns same reference when nothing to fix', () => {
    const m = { variant: 'package', viewProduct: { title: '오사카 3일', schedule: [] }, seo: { productDescription: 'x', breadcrumbItems: [] } } as unknown as ProductPublicDetailRenderModel
    expect(normalizeProductPublicDetailModelPlaceNames(m)).toBe(m)
  })
})
