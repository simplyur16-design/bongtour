import { describe, expect, it } from 'vitest'
import { keepOverseasCityLeafTaggedRows } from '@/lib/overseas-city-leaf-scoring-terms'

const yokohamaTerms = ['요코하마', 'yokohama', '일본', '간토']

describe('keepOverseasCityLeafTaggedRows', () => {
  // REGRESSION-FREEZE[yokohama-menu-city-terms]: 제목에 요코하마가 없어도 태그 상품을 남김 — manifest
  it('요코하마 leaf는 태그 상품이 있는데 제목 일치가 0이면 terms를 비운다', () => {
    expect(
      keepOverseasCityLeafTaggedRows({
        city: 'yokohama',
        leafTerms: yokohamaTerms,
        taggedCount: 4,
        textMatchCount: 0,
      }),
    ).toEqual([])
  })

  it('도쿄 leaf는 제목 일치가 있으면 terms를 유지한다', () => {
    const tokyoTerms = ['도쿄', 'tokyo', '일본', '간토']
    expect(
      keepOverseasCityLeafTaggedRows({
        city: 'tokyo',
        leafTerms: tokyoTerms,
        taggedCount: 7,
        textMatchCount: 4,
      }),
    ).toEqual(tokyoTerms)
  })
})
