import { describe, expect, it } from 'vitest'
import {
  isScheduleUserPlaceholder,
  resolvePublicScheduleDayDescription,
} from '@/lib/public-schedule-display'

describe('resolvePublicScheduleDayDescription', () => {
  it('hides empty / whitespace / placeholder (no empty box copy)', () => {
    expect(resolvePublicScheduleDayDescription('')).toBeNull()
    expect(resolvePublicScheduleDayDescription('   \n')).toBeNull()
    expect(resolvePublicScheduleDayDescription(null)).toBeNull()
    expect(resolvePublicScheduleDayDescription('없음')).toBeNull()
    expect(isScheduleUserPlaceholder('')).toBe(true)
  })

  it('keeps real day-1 arrival text', () => {
    const ok = '인천에서 출발해 다낭에 도착합니다. 다낭에서 첫날 일정을 이어갑니다.'
    expect(resolvePublicScheduleDayDescription(ok)).toBe(ok)
  })
})
