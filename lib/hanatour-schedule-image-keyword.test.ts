import { describe, expect, it } from 'vitest'
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'

describe('applyHanatourScheduleImageKeywordsToRows — 본문 명소 우선', () => {
  const indiaOpts = { productDestination: 'India' }

  it('도시명만 LLM이어도 본문 타지마할이 있으면 1순위 교정', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '아그라',
          description: '타지마할 외부 관람과 아그라 성 방문',
          routeText: '델리 - 아그라',
          imageKeyword: 'Agra',
          imageKeyword2: null,
        },
      ],
      indiaOpts,
    )
    expect(out[0]!.imageKeyword).toBe('Taj Mahal')
    expect(out[0]!.imageKeyword2).toBe('Agra Fort')
  })
})
