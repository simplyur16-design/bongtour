/**
 * REGRESSION-FREEZE[schedule-image-keyword-adjacent-poi]
 */
import { describe, expect, it } from 'vitest'
import {
  isScheduleAirportLikeImageKeyword,
  isScheduleAirportOnlyRouteText,
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
