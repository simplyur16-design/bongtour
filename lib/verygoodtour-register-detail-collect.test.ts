/**
 * REGRESSION-FREEZE[verygoodtour-register-detail-collect]
 */
import { describe, expect, it } from 'vitest'
import {
  needsVerygoodtourIncludedExcludedCollect,
  needsVerygoodtourScheduleCollect,
  verygoodItineraryToRegisterSchedule,
} from './verygoodtour-register-detail-collect'
import type { RegisterParsed } from './register-llm-schema-verygoodtour'

describe('verygoodtour register detail collect', () => {
  it('needs schedule collect when empty', () => {
    expect(needsVerygoodtourScheduleCollect({ schedule: [] } as RegisterParsed)).toBe(true)
    expect(
      needsVerygoodtourScheduleCollect({
        schedule: [{ day: 1, title: '오사카', description: '관광', imageKeyword: 'Osaka' }],
      } as RegisterParsed),
    ).toBe(false)
  })

  it('needs included/excluded when both missing', () => {
    expect(needsVerygoodtourIncludedExcludedCollect({} as RegisterParsed)).toBe(true)
    expect(
      needsVerygoodtourIncludedExcludedCollect({
        includedText: '항공권',
        excludedText: '팁',
      } as RegisterParsed),
    ).toBe(false)
  })

  it('maps itinerary day inputs to RegisterScheduleDay', () => {
    const days = verygoodItineraryToRegisterSchedule([
      {
        day: 1,
        dateText: null,
        city: '오사카',
        summaryTextRaw: '1일차 오사카 도착\n관광',
        poiNamesRaw: '오사카성 관광',
        meals: '석식 현지식',
        accommodation: '오사카 호텔',
        transport: '국제선 탑승',
        rawBlock: '1일차',
      },
    ])
    expect(days).toHaveLength(1)
    expect(days[0]?.title).toBe('오사카')
    expect(days[0]?.hotelText).toContain('오사카')
    expect(days[0]?.mealSummaryText).toContain('석식')
  })
})
