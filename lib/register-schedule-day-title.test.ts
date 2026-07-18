/**
 * REGRESSION-FREEZE[register-schedule-day-title-ssot]
 */
import { describe, expect, it } from 'vitest'
import { composeRegisterScheduleDayTitleFromRoute } from '@/lib/register-schedule-day-title'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
import { hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'
import { ybtourFactDaysToRegisterSchedule } from '@/lib/ybtour-register-api-schedule'

describe('register schedule day title SSOT', () => {
  it('routeText 2+ segments → first · last (not full chain)', () => {
    expect(
      composeRegisterScheduleDayTitleFromRoute({
        day: 2,
        maxDay: 5,
        routeText: '피렌체 - 시에나 - 베네치아',
      }),
    ).toBe('피렌체 · 베네치아')
  })

  // REGRESSION-FREEZE[register-schedule-day-title-ssot]: 주의사항 노이즈는 title 폴백 금지 — manifest
  it('주의사항·행정 문구는 title 폴백으로 쓰지 않음', () => {
    expect(
      composeRegisterScheduleDayTitleFromRoute({
        day: 1,
        maxDay: 5,
        routeText: '자유시간 시 주의사항 ※안전사고',
        fallbacks: ['필수 준비 사항'],
      }),
    ).toBe('1일차')
  })

  it('modetour — title ≠ full routeText', () => {
    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 2,
        places: ['피렌체', '시에나', '베네치아'],
        hotels: [],
        meals: [],
        transportNote: null,
      },
    ])
    expect(days[0]?.routeText).toMatch(/피렌체/)
    expect(days[0]?.title).toBe('피렌체 · 베네치아')
    expect(days[0]?.title).not.toBe(days[0]?.routeText)
  })

  it('hanatour — title short headline', () => {
    const days = hanatourFactDaysToRegisterSchedule([
      {
        day: 2,
        places: ['프라하 성', '카를교', '프라하'],
        hotels: [],
        meals: [],
        transportNote: null,
      },
    ])
    expect(days[0]?.title).toMatch(/프라하/)
    expect(days[0]?.title?.includes(' - ')).toBe(false)
  })

  it('ybtour — return day title', () => {
    const days = ybtourFactDaysToRegisterSchedule([
      {
        day: 5,
        places: [],
        hotels: [],
        meals: [],
        transportNote: '인천 귀국',
      },
    ])
    expect(days[0]?.title).toBe('귀국')
  })
})
