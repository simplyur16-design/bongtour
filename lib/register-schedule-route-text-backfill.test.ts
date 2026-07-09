/**
 * REGRESSION-FREEZE[register-schedule-route-expression-normalize]
 */
import { describe, expect, it } from 'vitest'
import { prepareRegisterScheduleRowsForImageKeywordApply } from '@/lib/register-schedule-route-text-backfill'

describe('register schedule route expression normalize — 신규 등록', () => {
  it('placeholder 요약을 routeText a–g로 교체', () => {
    const out = prepareRegisterScheduleRowsForImageKeywordApply([
      {
        day: 2,
        title:
          '땅이 끝나고 바다가 시작되는 곳, 까보다로까 - 유럽인들이 살고싶어 하는 최고의 포르투갈 휴양지, 카스카이스',
        description:
          '하루 동안 여러 장면이 자연스럽게 이어지는, 보기와 걷기가 균형 잡힌 알찬 동선입니다. 특정 장소보다 전체적인 흐름과 분위기를 중심으로 여행의 컨셉을 느끼기 좋은 일정입니다.',
        routeText:
          '땅이 끝나고 바다가 시작되는 곳, 까보다로까 - 카스카이스 - 신트라 관광',
      },
    ])
    expect(out[0]?.routeText).toBe('까보다로까 - 카스카이스 - 신트라')
    expect(out[0]?.description).toBe(out[0]?.routeText)
    expect(out[0]?.description).not.toMatch(/하루\s*동안\s*여러\s*장면/)
    expect(out[0]?.title).not.toMatch(/살고싶어/)
  })
})
