import { describe, expect, it } from 'vitest'
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'

describe('splitRouteTextPlaceSegments', () => {
  it('splits comma and hyphen separators', () => {
    expect(splitRouteTextPlaceSegments('마드리드, 루고')).toEqual(['마드리드', '루고'])
    expect(splitRouteTextPlaceSegments('루고 - 사리아 - 포르토마린')).toEqual([
      '루고',
      '사리아',
      '포르토마린',
    ])
  })
})

describe('applyHanatourScheduleImageKeywordsToRows — 스페인 순례(Camino)', () => {
  const spainOpts = { productDestination: '스페인' }

  it('쉼표·하이픈 한글 routeText에서 Madrid/Lugo/Sarria/Portomarin 추론', () => {
    const rows = [
      {
        day: 1,
        title: '인천 출발',
        description: '인천국제공항 출발',
        routeText: '인천',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '마드리드·루고',
        description: '마드리드 도착 후 루고 이동',
        routeText: '마드리드, 루고',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '순례 도보',
        description: '사리아 구간 트레킹',
        routeText: '루고 - 사리아 - 포르토마린',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '순례 도보',
        description: '팔라스 데 레이 방향',
        routeText: '루고 - 포르토마린 - 팔레스데레이',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    const out = applyHanatourScheduleImageKeywordsToRows(rows, spainOpts)
    expect(out[0]!.imageKeyword).toBe('Madrid')
    expect(out[1]!.imageKeyword).toBe('Madrid')
    // secondary: Lugo는 destination city로 분류되어 imageKeyword2 후보에서 제외될 수 있음
    expect(out[1]!.imageKeyword2).toBeNull()
    expect(out[2]!.imageKeyword).toBe('Sarria')
    expect(out[2]!.imageKeyword2).toBe('Portomarin')
    expect(out[3]!.imageKeyword).toBe('Portomarin')
    expect(out[3]!.imageKeyword).not.toBe('Spain')
    expect(out[3]!.imageKeyword2).toBeNull()
  })
})
