/**
 * REGRESSION-FREEZE[schedule-image-keyword-adjacent-poi]
 */
import { describe, expect, it } from 'vitest'
import {
  isScheduleAirportLikeImageKeyword,
  isScheduleAirportOnlyRouteText,
  isScheduleDepartureReturnAdjacentRouteText,
  isScheduleDomesticHubOnlyRouteText,
  isScheduleInFlightOvernightRow,
  pickUnusedScheduleImageKeywordFromAdjacentDays,
} from '@/lib/schedule-image-keyword-adjacent-poi'
import { normalizeSemanticPoiKey } from '@/lib/pexels-keyword'

const normKey = (s: string) => normalizeSemanticPoiKey(s)
const isHub = (t: string) => /^(?:인천|Incheon|ICN)$/i.test(t.trim())

describe('isScheduleInFlightOvernightRow', () => {
  it('기내박 routeText', () => {
    expect(isScheduleInFlightOvernightRow({ routeText: '기내박' })).toBe(true)
    expect(isScheduleInFlightOvernightRow({ routeText: '뉴욕' })).toBe(false)
  })
})

describe('isScheduleAirportOnlyRouteText', () => {
  it('공항·허브만', () => {
    expect(
      isScheduleAirportOnlyRouteText('인천 - 인천국제공항 - 존 F. 케네디 국제공항', isHub),
    ).toBe(true)
    expect(isScheduleAirportOnlyRouteText('워싱턴 - 링컨 기념관', isHub)).toBe(false)
  })
})

describe('isScheduleDomesticHubOnlyRouteText', () => {
  it('국내 허브만 — airline-only·관광 혼합 제외', () => {
    expect(isScheduleDomesticHubOnlyRouteText('인천', isHub)).toBe(true)
    expect(isScheduleDomesticHubOnlyRouteText('에어프레미아 항공 - 에어프리미아', isHub)).toBe(false)
    expect(isScheduleDomesticHubOnlyRouteText('인천 - 존 F. 케네디 국제공항', isHub)).toBe(false)
    expect(isScheduleDomesticHubOnlyRouteText('워싱턴 - 링컨 기념관', isHub)).toBe(false)
  })
})

describe('isScheduleDepartureReturnAdjacentRouteText', () => {
  it('하나투어 API filler — adjacent fill 대상', () => {
    const filler =
      '하루 동안 여러 장면이 자연스럽게 이어지는, 보기와 걷기가 균형 잡힌 알찬 동선입니다. 특정 장소보다 전체적인 흐름과 분위기를 중심으로 여행의 컨셉을 느끼기 좋은 일정입니다.'
    expect(isScheduleDepartureReturnAdjacentRouteText(filler, isHub)).toBe(true)
    expect(isScheduleDepartureReturnAdjacentRouteText('인천', isHub)).toBe(true)
    expect(isScheduleDepartureReturnAdjacentRouteText('카와라우 - 애로우타운', isHub)).toBe(false)
  })
})

describe('isScheduleAirportLikeImageKeyword', () => {
  it('공항 문자열 거부', () => {
    expect(isScheduleAirportLikeImageKeyword('JFK International Airport')).toBe(true)
    expect(isScheduleAirportLikeImageKeyword('Lincoln Memorial')).toBe(false)
  })
})

describe('pickUnusedScheduleImageKeywordFromAdjacentDays', () => {
  const rows = [
    { day: 1, routeText: '인천 - JFK', candidates: [] as string[] },
    {
      day: 2,
      routeText: 'Washington - Lincoln Memorial - Smithsonian',
      candidates: ['Smithsonian Museum', 'Lincoln Memorial'],
    },
    { day: 3, routeText: '기내박', candidates: [] as string[] },
    {
      day: 4,
      routeText: 'Niagara Falls',
      candidates: ['Niagara Falls', 'Skylon Tower'],
    },
  ]

  it('D1 forward — D2 미사용 명소', () => {
    const used = new Set<string>()
    const kw = pickUnusedScheduleImageKeywordFromAdjacentDays({
      anchorDay: 1,
      maxDay: 4,
      sorted: rows,
      getDay: (r) => r.day,
      used,
      normKey,
      collectLandmarkCandidates: (r) => r.candidates,
      scan: 'forward',
    })
    expect(kw).toBe('Smithsonian Museum')
  })

  it('기내박 middle — 전후일 미사용', () => {
    const used = new Set([normKey('Smithsonian Museum'), normKey('Lincoln Memorial')])
    const kw = pickUnusedScheduleImageKeywordFromAdjacentDays({
      anchorDay: 3,
      maxDay: 4,
      sorted: rows,
      getDay: (r) => r.day,
      used,
      normKey,
      collectLandmarkCandidates: (r) => r.candidates,
      scan: 'both',
    })
    expect(kw).toBe('Niagara Falls')
  })
})
