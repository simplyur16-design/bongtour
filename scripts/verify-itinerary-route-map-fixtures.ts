/**
 * DB 없이 일정 동선 지도 거점·SVG 렌더 품질 검증.
 *   npx tsx scripts/verify-itinerary-route-map-fixtures.ts
 */

import { resolveItineraryRouteMapCountry } from '../lib/itinerary-route-map-country'
import {
  extractItineraryRouteMapHubs,
  parseScheduleJsonForRouteMap,
} from '../lib/itinerary-route-map-hubs'
import { resolveRouteMapRegionId } from '../lib/itinerary-route-map-geo'
import { buildItineraryRouteMapSvg } from '../lib/itinerary-route-map-render-svg'
import type { ItineraryRouteMapScheduleDay } from '../lib/itinerary-route-map-types'

type Case = {
  name: string
  country: string
  schedule: ItineraryRouteMapScheduleDay[]
  expectCities: string[]
  expectRegion?: string
  minHubs?: number
}

const CASES: Case[] = [
  {
    name: '일본 도쿄·하코네·교토·오사카',
    country: '일본',
    expectCities: ['도쿄', '하코네', '교토', '오사카'],
    expectRegion: 'japan',
    schedule: [
      { day: 1, routeText: '인천 - 도쿄', description: '도착' },
      { day: 2, routeText: '도쿄 - 아사쿠사', description: '시내' },
      { day: 3, routeText: '도쿄', description: '자유' },
      { day: 4, routeText: '도쿄 - 하코네', description: '신칸센 약 1시간 30분' },
      { day: 5, routeText: '하코네 - 교토', description: '기차 약 2시간' },
      { day: 6, routeText: '교토', description: '사찰' },
      { day: 7, routeText: '교토 - 오사카', description: '전철 약 30분' },
      { day: 8, routeText: '오사카 - 인천', description: '귀국' },
    ],
  },
  {
    name: '오사카·교토 권역',
    country: '일본',
    expectCities: ['오사카', '교토'],
    expectRegion: 'kansai',
    schedule: [
      { day: 1, routeText: '인천 - 오사카', description: '도착' },
      { day: 2, routeText: '오사카 - 교토', description: '전철 약 30분' },
      { day: 3, routeText: '교토 - 인천', description: '귀국' },
    ],
  },
  {
    name: '베트남 다낭·호이안·나트랑',
    country: '베트남',
    expectCities: ['다낭', '나트랑'],
    expectRegion: 'vietnam',
    minHubs: 2,
    schedule: [
      { day: 1, routeText: '인천 - 다낭', description: '도착' },
      { day: 2, routeText: '다낭 - 호이안', description: '시내' },
      { day: 3, routeText: '다낭', description: '바나힐' },
      { day: 4, routeText: '다낭 - 나트랑', description: '비행 약 1시간' },
      { day: 5, routeText: '나트랑', description: '해변' },
      { day: 6, routeText: '나트랑 - 인천', description: '귀국' },
    ],
  },
  {
    name: '다낭·호이안 권역',
    country: '베트남',
    expectCities: ['다낭', '호이안'],
    expectRegion: 'central-vietnam',
    schedule: [
      { day: 1, routeText: '인천 - 다낭', description: '도착' },
      { day: 2, routeText: '다낭 - 호이안', description: '버스 약 1시간' },
      { day: 3, routeText: '다낭', description: '자유' },
      { day: 4, routeText: '다낭 - 인천', description: '귀국' },
    ],
  },
  {
    name: '단일 거점(괌) — 지도 생성 차단 기대',
    country: '괌',
    expectCities: ['괌'],
    minHubs: 1,
    schedule: [
      { day: 1, routeText: '인천 - 괌', description: '도착' },
      { day: 2, routeText: '괌', description: '투몬' },
      { day: 3, routeText: '괌', description: '자유' },
      { day: 4, routeText: '괌 - 인천', description: '귀국' },
    ],
  },
]

function main() {
  let fail = 0
  const rows: Record<string, unknown>[] = []

  for (const c of CASES) {
    const schedule = parseScheduleJsonForRouteMap(c.schedule)
    const { hubs, legs } = extractItineraryRouteMapHubs(schedule)
    const { countryKo, countryEn } = resolveItineraryRouteMapCountry({
      country: c.country,
      destination: c.country,
    })
    const cities = hubs.map((h) => h.cityKo)
    const minHubs = c.minHubs ?? 2
    const canGenerate = hubs.length >= 2
    const missingExpected = c.expectCities.filter((x) => !cities.includes(x))
    const regionId = resolveRouteMapRegionId(hubs, countryEn)

    const issues: string[] = []
    if (hubs.length < minHubs && c.name.includes('차단')) {
      /* expected */
    } else if (hubs.length < minHubs && !c.name.includes('차단')) {
      issues.push(`거점부족:${hubs.length}<${minHubs}`)
    }
    if (missingExpected.length && hubs.length >= 2) {
      if (missingExpected.length === c.expectCities.length)
        issues.push(`기대도시전부누락:${missingExpected.join(',')}`)
    }
    if (c.expectRegion && canGenerate && regionId !== c.expectRegion) {
      issues.push(`권역불일치:${regionId}!=${c.expectRegion}`)
    }
    if (c.name.includes('차단') && canGenerate) issues.push('단일거점인데생성가능으로판정')

    let svgChars = 0
    if (canGenerate) {
      const svg = buildItineraryRouteMapSvg({ hubs, legs, countryEn })
      svgChars = svg.length
      if (!svg.includes('<svg') || svgChars < 500) issues.push('SVG렌더불량')
      if (!svg.includes(COLORS_LAND_CHECK)) issues.push('육지색누락')
      // 한글 도시 칩
      for (const city of cities.slice(0, 2)) {
        if (city && !svg.includes(city)) issues.push(`도시칩누락:${city}`)
      }
    }

    if (issues.length) fail++
    rows.push({
      name: c.name,
      countryEn,
      countryKo,
      regionId,
      hubs: hubs.map((h) => `${h.cityKo}(${h.dayLabel})`).join('→'),
      legs: legs.length,
      canGenerate,
      svgChars,
      missingExpected,
      issues,
    })
  }

  console.log(JSON.stringify({ fail, total: CASES.length, rows }, null, 2))
  if (fail > 0) process.exitCode = 1
}

const COLORS_LAND_CHECK = '#E4DDD0'

main()
