import { describe, expect, it } from 'vitest'
import { inferProductKindFromFactScheduleDays } from '@/lib/register-kind-from-itinerary'
import { inferHanatourRegisterFactProductKind } from '@/lib/register-facts/product-kind'

// 자동 수집(팩트 번들 places) 경로 — 사장님 규칙: 신규·등록대기·등록 모두 원문 일자별 일정 유무만
const freeDays = [
  { day: 1, places: ['인천 출발', '사이판 도착'] },
  { day: 2, places: ['일일 자유 일정'] },
  { day: 3, places: ['일일 자유 일정'] },
  { day: 4, places: ['사이판 출발'] },
]
const tourDays = [
  { day: 1, places: ['인천 출발'] },
  { day: 2, places: ['몬세라트 수도원 관광', '가우디 투어'] },
  { day: 3, places: ['일일 자유 일정'] },
  { day: 4, places: ['귀국'] },
]

describe('inferProductKindFromFactScheduleDays', () => {
  it('empty / missing schedule → null (기존 차단 경로 유지)', () => {
    expect(inferProductKindFromFactScheduleDays([])).toBeNull()
    expect(inferProductKindFromFactScheduleDays(null)).toBeNull()
  })
  it('middle days all free → air_hotel_free', () => {
    expect(inferProductKindFromFactScheduleDays(freeDays)).toBe('air_hotel_free')
  })
  it('a concrete sight in a middle day → package', () => {
    expect(inferProductKindFromFactScheduleDays(tourDays)).toBe('package')
  })
  it('middle days with no places → air_hotel_free', () => {
    expect(
      inferProductKindFromFactScheduleDays([{ day: 1, places: ['출발'] }, { day: 2, places: [] }, { day: 3, places: [] }, { day: 4, places: ['귀국'] }]),
    ).toBe('air_hotel_free')
  })
})

describe('inferHanatourRegisterFactProductKind with itinerary', () => {
  it('itinerary beats supplier code letters', () => {
    // 코드 글자 추론 결과와 무관하게 일정이 결정
    expect(inferHanatourRegisterFactProductKind(null, 'https://www.hanatour.com/package/detail?pkgCd=AAP123250801OZA', freeDays)).toBe('air_hotel_free')
    expect(inferHanatourRegisterFactProductKind(null, 'https://www.hanatour.com/package/detail?pkgCd=AAP123250801OZA&type=H01', tourDays)).toBe('package')
  })
})
