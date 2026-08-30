import { describe, expect, it } from 'vitest'
import { inferSportsThemeTagsFromListingHaystack } from '@/lib/product-listing-kind'

describe('inferSportsThemeTagsFromListingHaystack', () => {
  it('maps 골프·트레킹 제목을 테마 태그로', () => {
    expect(inferSportsThemeTagsFromListingHaystack('사이판 골프 4일')).toEqual(['golf'])
    expect(inferSportsThemeTagsFromListingHaystack('네팔 트레킹 10일')).toEqual(['trekking'])
  })

  it('메가메뉴 테마 키를 그대로 넣는다', () => {
    expect(inferSportsThemeTagsFromListingHaystack('오사카 3일', ['golf'])).toEqual(['golf'])
  })

  it('일반 패키지 제목에는 테마를 붙이지 않는다', () => {
    expect(inferSportsThemeTagsFromListingHaystack('서유럽 10일 패키지')).toEqual([])
  })
})
