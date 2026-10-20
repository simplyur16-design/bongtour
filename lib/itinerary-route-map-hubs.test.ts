import { describe, expect, it } from 'vitest'
import {
  extractItineraryRouteMapHubs,
  formatItineraryRouteMapDayLabel,
  parseScheduleJsonForRouteMap,
} from '@/lib/itinerary-route-map-hubs'
import { resolveItineraryRouteMapCountry } from '@/lib/itinerary-route-map-country'
import { resolveRouteMapRegionId } from '@/lib/itinerary-route-map-geo'
import { buildItineraryRouteMapSvg } from '@/lib/itinerary-route-map-render-svg'

describe('itinerary-route-map-hubs', () => {
  it('formatDayLabel — 연속/비연속', () => {
    expect(formatItineraryRouteMapDayLabel([1, 2, 3])).toBe('1~3')
    expect(formatItineraryRouteMapDayLabel([4])).toBe('4')
    expect(formatItineraryRouteMapDayLabel([5, 6])).toBe('5~6')
    expect(formatItineraryRouteMapDayLabel([1, 3, 5])).toBe('1,3,5')
  })

  it('일본 도쿄→하코네→교토→오사카 거점 묶음 + SVG', () => {
    const schedule = parseScheduleJsonForRouteMap([
      { day: 1, routeText: '인천 - 도쿄', description: '도착' },
      { day: 2, routeText: '도쿄 - 아사쿠사', description: '시내' },
      { day: 3, routeText: '도쿄', description: '자유' },
      { day: 4, routeText: '도쿄 - 하코네', description: '신칸센 약 1시간 30분' },
      { day: 5, routeText: '하코네 - 교토', description: '기차 약 2시간' },
      { day: 6, routeText: '교토', description: '사찰' },
      { day: 7, routeText: '교토 - 오사카', description: '전철 약 30분' },
      { day: 8, routeText: '오사카 - 인천', description: '귀국' },
    ])
    const { hubs, legs } = extractItineraryRouteMapHubs(schedule)
    expect(hubs.map((h) => h.cityKo)).toEqual(
      expect.arrayContaining(['도쿄', '하코네', '교토', '오사카']),
    )
    expect(hubs.find((h) => h.cityKo === '도쿄')?.dayLabel).toMatch(/1/)
    expect(legs.length).toBeGreaterThanOrEqual(3)
    const svg = buildItineraryRouteMapSvg({ hubs, legs, countryEn: 'JAPAN' })
    expect(svg).toContain('<svg')
    expect(svg).toContain('#E4DDD0')
    expect(svg.length).toBeGreaterThan(500)
  })

  it('오사카·교토 → kansai 권역', () => {
    const schedule = parseScheduleJsonForRouteMap([
      { day: 1, routeText: '인천 - 오사카', description: '도착' },
      { day: 2, routeText: '오사카 - 교토', description: '전철 약 30분' },
      { day: 3, routeText: '교토 - 인천', description: '귀국' },
    ])
    const { hubs } = extractItineraryRouteMapHubs(schedule)
    expect(resolveRouteMapRegionId(hubs, 'JAPAN')).toBe('kansai')
  })

  it('패키지 기본 지상이동 = 전용차량 (고양이열차 오탐 방지)', () => {
    const schedule = parseScheduleJsonForRouteMap([
      { day: 1, routeText: '인천 - 오사카', description: '도착' },
      {
        day: 2,
        routeText: '오사카 - 교토',
        description: '전일 관광 고양이열차 체험 포함',
      },
      { day: 3, routeText: '교토 - 인천', description: '귀국' },
    ])
    const { legs } = extractItineraryRouteMapHubs(schedule)
    const hop = legs.find((l) => l.fromCityKo === '오사카' && l.toCityKo === '교토')
    expect(hop?.icon).toBe('🚗')
    expect(hop?.durationLabel).toMatch(/약/)
  })

  it('일정에 신칸센이 명시되면 기차 유지', () => {
    const schedule = parseScheduleJsonForRouteMap([
      { day: 1, routeText: '도쿄', description: '시내' },
      { day: 2, routeText: '도쿄 - 교토', description: '신칸센 약 2시간 15분' },
      { day: 3, routeText: '교토', description: '사찰' },
    ])
    const { legs } = extractItineraryRouteMapHubs(schedule)
    expect(legs.some((l) => l.icon === '🚄')).toBe(true)
  })

  it('resolve country EN', () => {
    expect(resolveItineraryRouteMapCountry({ country: '일본' }).countryEn).toBe('JAPAN')
    expect(resolveItineraryRouteMapCountry({ destination: '베트남/다낭' }).countryEn).toBe(
      'VIETNAM',
    )
  })
})
