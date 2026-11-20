import { describe, expect, it } from 'vitest'
import type { ItineraryRouteMapHub, ItineraryRouteMapLeg } from '@/lib/itinerary-route-map-types'
import {
  lookupItineraryPlaceNominatim,
  resetItineraryPlaceNominatimStateForTests,
  type NominatimLookupDeps,
} from '@/lib/itinerary-route-map-nominatim'
import { locateItineraryRouteMapHubs } from '@/lib/itinerary-route-map-locate'
import {
  extractItineraryRouteMapHubs,
  parseScheduleJsonForRouteMap,
} from '@/lib/itinerary-route-map-hubs'
import { buildItineraryRouteMapSvg } from '@/lib/itinerary-route-map-render-svg'

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response
}

describe('itinerary nominatim', () => {
  it('캐시가 있으면 다시 요청하지 않는다', async () => {
    resetItineraryPlaceNominatimStateForTests()
    let calls = 0
    const deps: NominatimLookupDeps = {
      fetchImpl: async () => {
        calls += 1
        return jsonResponse([{ lat: '35.0', lon: '135.0' }])
      },
      sleepImpl: async () => {},
      randomImpl: () => 0,
      nowImpl: () => 1_000_000,
    }
    const a = await lookupItineraryPlaceNominatim('교토', deps)
    const b = await lookupItineraryPlaceNominatim('교토', deps)
    expect(a).toEqual({ lon: 135, lat: 35 })
    expect(b).toEqual(a)
    expect(calls).toBe(1)
  })

  it('요청 사이에 간격과 지터를 둔다', async () => {
    resetItineraryPlaceNominatimStateForTests()
    const slept: number[] = []
    let now = 0
    const deps: NominatimLookupDeps = {
      fetchImpl: async () => jsonResponse([{ lat: '1', lon: '2' }]),
      sleepImpl: async (ms) => {
        slept.push(ms)
        now += ms
      },
      randomImpl: () => 0.5,
      nowImpl: () => now,
    }
    await lookupItineraryPlaceNominatim('오사카', deps)
    await lookupItineraryPlaceNominatim('고베', deps)
    expect(slept.length).toBeGreaterThanOrEqual(2)
    expect(slept[0]).toBe(1100 + 200)
    expect(slept[1]).toBe(1100 + 200)
  })

  it('실패하면 한 번만 다시 시도하고, 또 실패하면 SKIP', async () => {
    resetItineraryPlaceNominatimStateForTests()
    let calls = 0
    const deps: NominatimLookupDeps = {
      fetchImpl: async () => {
        calls += 1
        throw new Error('down')
      },
      sleepImpl: async () => {},
      randomImpl: () => 0,
      nowImpl: () => 5_000,
    }
    const missed = await lookupItineraryPlaceNominatim('없는곳', deps)
    expect(missed).toBeNull()
    expect(calls).toBe(2)
    const again = await lookupItineraryPlaceNominatim('없는곳', deps)
    expect(again).toBeNull()
    expect(calls).toBe(2)
  })

  it('한 번 실패 후 재시도가 되면 좌표를 쓴다', async () => {
    resetItineraryPlaceNominatimStateForTests()
    let calls = 0
    const deps: NominatimLookupDeps = {
      fetchImpl: async () => {
        calls += 1
        if (calls === 1) return jsonResponse([], false)
        return jsonResponse([{ lat: '34.7', lon: '135.5' }])
      },
      sleepImpl: async () => {},
      randomImpl: () => 0,
      nowImpl: () => 9_000,
    }
    const point = await lookupItineraryPlaceNominatim('오사카', deps)
    expect(calls).toBe(2)
    expect(point).toEqual({ lon: 135.5, lat: 34.7 })
  })
})

describe('원문 일정 지명', () => {
  it('원문에 없는 도시명으로 바꾸지 않는다', () => {
    const schedule = parseScheduleJsonForRouteMap([
      { day: 1, routeText: '인천 - 아라시야마', description: '대나무숲' },
      { day: 2, routeText: '아라시야마 - 인천', description: '귀국' },
    ])
    const { hubs } = extractItineraryRouteMapHubs(schedule)
    expect(hubs.map((h) => h.cityKo)).toContain('아라시야마')
    expect(hubs.map((h) => h.cityKo)).not.toContain('교토')
  })

  it('방문하지 않은 권역 지명은 SVG에 넣지 않는다', () => {
    const schedule = parseScheduleJsonForRouteMap([
      { day: 1, routeText: '인천 - 오사카', description: '도착' },
      { day: 2, routeText: '오사카 - 교토', description: '전철 약 30분' },
      { day: 3, routeText: '교토 - 인천', description: '귀국' },
    ])
    const { hubs, legs } = extractItineraryRouteMapHubs(schedule)
    const svg = buildItineraryRouteMapSvg({ hubs, legs, countryEn: 'JAPAN' })
    expect(svg).toContain('오사카')
    expect(svg).toContain('교토')
    expect(svg).not.toContain('>나라<')
    expect(svg).not.toContain('>고베<')
  })

  it('좌표를 못 구한 지명은 건너뛰고 남은 거점으로 구간을 잇는다', async () => {
    resetItineraryPlaceNominatimStateForTests()
    const hubs: ItineraryRouteMapHub[] = [
      { cityKo: '오사카', cityEn: 'Osaka', dayLabel: '1', days: [1] },
      { cityKo: '없는마을', cityEn: '없는마을', dayLabel: '2', days: [2] },
      { cityKo: '교토', cityEn: 'Kyoto', dayLabel: '3', days: [3] },
    ]
    const legs: ItineraryRouteMapLeg[] = [
      { fromCityKo: '오사카', toCityKo: '없는마을', icon: '🚗', durationLabel: '약 1시간', lineStyle: 'dashed_green' },
      { fromCityKo: '없는마을', toCityKo: '교토', icon: '🚄', durationLabel: '약 30분', lineStyle: 'dashed_green' },
    ]
    const located = await locateItineraryRouteMapHubs(hubs, legs, {
      fetchImpl: async () => {
        throw new Error('down')
      },
      sleepImpl: async () => {},
      randomImpl: () => 0,
      nowImpl: () => 20_000,
    })
    expect(located.hubs.map((h) => h.cityKo)).toEqual(['오사카', '교토'])
    expect(located.legs).toHaveLength(1)
    expect(located.legs[0]?.fromCityKo).toBe('오사카')
    expect(located.legs[0]?.toCityKo).toBe('교토')
    expect(located.skipped).toEqual(['없는마을'])
  })
})
