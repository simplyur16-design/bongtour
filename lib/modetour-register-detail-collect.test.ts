/**
 * REGRESSION-FREEZE[modetour-register-detail-collect]
 */
import { describe, expect, it } from 'vitest'
import {
  modetourFactDaysToRegisterSchedule,
  needsModetourIncludedExcludedCollect,
  needsModetourScheduleCollect,
} from './modetour-register-detail-collect'
import type { RegisterParsed } from './register-llm-schema-modetour'

describe('modetour register detail collect', () => {
  it('needs schedule collect when empty', () => {
    expect(needsModetourScheduleCollect({ schedule: [] } as RegisterParsed)).toBe(true)
    expect(
      needsModetourScheduleCollect({
        schedule: [{ day: 1, title: '오사카', description: '관광', imageKeyword: 'Osaka' }],
      } as RegisterParsed),
    ).toBe(false)
  })

  it('needs included/excluded when both missing', () => {
    expect(needsModetourIncludedExcludedCollect({} as RegisterParsed)).toBe(true)
    expect(
      needsModetourIncludedExcludedCollect({
        includedText: '항공권',
        excludedText: '팁',
      } as RegisterParsed),
    ).toBe(false)
  })

  it('maps B2C fact days to RegisterScheduleDay', () => {
    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 1,
        places: ['인천', '구마모토'],
        hotels: ['구마모토 호텔'],
        meals: ['기내식', '석식 현지식'],
        transportNote: '국제선 탑승',
      },
    ])
    expect(days).toHaveLength(1)
    expect(days[0]?.title).toBe('인천')
    expect(days[0]?.routeText).toBe('인천 - 구마모토')
    expect(days[0]?.hotelText).toContain('구마모토')
    expect(days[0]?.dinnerText).toContain('석식')
  })
})
