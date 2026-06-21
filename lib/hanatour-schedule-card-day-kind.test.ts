import { describe, expect, it } from 'vitest'
import {
  classifyHanatourScheduleCardDayKind,
  isHanatourMovementPatternDay,
} from './hanatour-schedule-card-day-kind'

describe('classifyHanatourScheduleCardDayKind', () => {
  it('classifies return_home on last-day ICN departure from origin', () => {
    const joined = '상해 출발 인천 ICN 도착 귀국 탑승'
    expect(classifyHanatourScheduleCardDayKind(5, 5, joined)).toBe('return_home')
  })

  it('classifies movement on day-1 airport arrival', () => {
    const joined = '인천 출발 상해 PVG 도착 입국 미팅 하나투어 가이드'
    expect(classifyHanatourScheduleCardDayKind(1, 5, joined)).toBe('movement')
    expect(isHanatourMovementPatternDay(joined, 1, 5)).toBe(true)
  })

  it('classifies tourism when sightseeing evidence dominates', () => {
    const joined = '오슬로 시내 관광 — 비그란드 둘러보기 명소 방문'
    expect(classifyHanatourScheduleCardDayKind(2, 5, joined)).toBe('tourism')
  })
})
