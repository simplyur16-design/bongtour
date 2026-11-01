import { describe, expect, it } from 'vitest'
import { registerScheduleRouteIsCityOnly } from '@/lib/register-schedule-city-only-day'
import { registerScheduleDayRequiresPrimaryImageKeyword } from '@/lib/register-pre-photo-verify'

describe('registerScheduleRouteIsCityOnly (도시만 있는 날)', () => {
  it('경유·이동 도시만 있는 날은 도시만 날', () => {
    expect(registerScheduleRouteIsCityOnly('두바이 - 아테네')).toBe(true)
    expect(registerScheduleRouteIsCityOnly('아테네 - 두바이')).toBe(true)
    expect(registerScheduleRouteIsCityOnly('하노이')).toBe(true)
  })
  it('명소가 있으면 도시만 날 아님', () => {
    expect(registerScheduleRouteIsCityOnly('도쿄 - 아사쿠사 관음사')).toBe(false)
    expect(registerScheduleRouteIsCityOnly('하노이 - 호안끼엠 호수')).toBe(false)
    expect(registerScheduleRouteIsCityOnly('')).toBe(false)
  })
  it('도시 이름이 곧 명소인 곳(우유니·이과수·카르타고·마트마타)은 도시만 날 아님', () => {
    expect(registerScheduleRouteIsCityOnly('우유니')).toBe(false)
    expect(registerScheduleRouteIsCityOnly('이과수')).toBe(false)
    expect(registerScheduleRouteIsCityOnly('튀니스 - 카르타고')).toBe(false)
    expect(registerScheduleRouteIsCityOnly('마트마타')).toBe(false)
  })
  it('자유일정 날은 도시만 날 아님(추천일정 키워드 유지)', () => {
    expect(registerScheduleRouteIsCityOnly('하노이 - 전일 자유일정')).toBe(false)
  })
  it('도시만 있는 중간일은 키워드를 강제하지 않는다', () => {
    expect(registerScheduleDayRequiresPrimaryImageKeyword('middle', '두바이 - 아테네')).toBe(false)
    expect(registerScheduleDayRequiresPrimaryImageKeyword('middle', '도쿄 - 아사쿠사 관음사')).toBe(true)
  })
})
