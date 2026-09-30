import { describe, expect, it } from 'vitest'
import { sortProductsBySeason, SEASONAL_PICK_BADGE_PER_KEYWORD } from '@/lib/product-sort'

describe('sortProductsBySeason', () => {
  // REGRESSION-FREEZE[seasonal-pick-badge-one-per-keyword]: 일본 권역 전 상품 배지 금지 — manifest
  it('시즌 키워드에 많이 맞아도 배지는 키워드당 1건만', () => {
    const products = Array.from({ length: 12 }, (_, i) => ({
      id: `jp-${i}`,
      title: `일본 도쿄 패키지 ${i}`,
      primaryDestination: '도쿄',
      primaryRegion: '일본',
    }))
    const { items, seasonalPickIds } = sortProductsBySeason(products, 9, {
      dateSeed: new Date('2026-09-15T00:00:00+09:00'),
    })
    expect(items.length).toBe(12)
    expect(seasonalPickIds.size).toBe(SEASONAL_PICK_BADGE_PER_KEYWORD)
    expect(seasonalPickIds.has(items[0]!.id)).toBe(true)
  })

  it('서로 다른 시즌 키워드는 각각 배지 1건', () => {
    const products = [
      { id: 'a', title: '일본 오사카', primaryDestination: '오사카', primaryRegion: '일본' },
      { id: 'b', title: '일본 도쿄', primaryDestination: '도쿄', primaryRegion: '일본' },
      { id: 'c', title: '대만 타이베이', primaryDestination: '타이베이', primaryRegion: '대만' },
      { id: 'd', title: '베트남 다낭', primaryDestination: '다낭', primaryRegion: '베트남' },
      { id: 'e', title: '유럽 파리', primaryDestination: '파리', primaryRegion: '유럽' },
    ]
    const { seasonalPickIds } = sortProductsBySeason(products, 9, {
      dateSeed: new Date('2026-09-15T00:00:00+09:00'),
    })
    // 9월: 일본·대만·베트남 → 최대 3
    expect(seasonalPickIds.size).toBe(3)
    expect(seasonalPickIds.has('e')).toBe(false)
  })
})
