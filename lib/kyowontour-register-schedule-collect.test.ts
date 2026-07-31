/**
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]
 */
import { describe, expect, it } from 'vitest'
import {
  needsKyowontourScheduleCollect,
  scheduleTabParsedToRegisterDays,
} from './kyowontour-register-schedule-collect'
import { CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE, parseKyowontourScheduleTabDetail } from './kyowontour-tour-event-tab-data'
import type { RegisterParsed } from './register-llm-schema-kyowontour'

describe('kyowontour register schedule collect mapping', () => {
  it('needs collect when schedule empty and LLM extract not filled', () => {
    const parsed = { schedule: [] } as RegisterParsed
    expect(needsKyowontourScheduleCollect(parsed)).toBe(true)
    expect(needsKyowontourScheduleCollect({ ...parsed, kyowontourScheduleExtractFilled: true })).toBe(false)
    expect(
      needsKyowontourScheduleCollect({
        ...parsed,
        schedule: [{ day: 1, title: '쿤밍', description: '출발', imageKeyword: 'Kunming' }],
      }),
    ).toBe(true)
    expect(
      needsKyowontourScheduleCollect({
        ...parsed,
        kyowontourScheduleExtractFilled: true,
        schedule: [
          {
            day: 1,
            title: '쿤밍',
            description: '출발',
            imageKeyword: 'Kunming',
            breakfastText: '호텔식',
            lunchText: '현지식',
            dinnerText: '현지식',
            hotelText: '호텔A',
          },
        ],
      }),
    ).toBe(false)
  })

  it('maps goodsEvtTab_2 rows to RegisterScheduleDay[]', () => {
    const tab = parseKyowontourScheduleTabDetail(CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE)
    const days = scheduleTabParsedToRegisterDays(tab)
    expect(days[0]?.breakfastText).toBeNull()
    expect(days[0]?.dinnerText).toBe('현지식(중식)')
    expect(days[0]?.routeText).toBe('쿤밍')
    // vibe 템플릿 문구는 슬롯별로 단어가 갈린다 — 하드코딩 한 단어에 묶지 않는다.
    expect(days[0]?.description).toMatch(/하루|동선|분위기|리듬|일정|구성|탐색/)
    expect(days[0]?.description).not.toBe(days[0]?.routeText)
    expect(days[1]?.breakfastText).toBe('호텔식')
    expect(days[1]?.routeText).toBe('여강고성 - 대,소석림')
    expect(days[1]?.routeText?.split(' - ').length).toBe(2)
    // description SSOT = vibe 2~3문장 (routeText 장소명 복사 금지)
    expect(days[1]?.description).toMatch(/하루|동선|분위기|흐름|리듬|일정|구성/)
    expect(days[1]?.description).not.toContain('여강고성')
  })
})
