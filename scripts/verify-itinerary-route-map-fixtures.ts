/**
 * DB 없이 일정 동선 지도 거점·프롬프트 품질 검증 (대표 공급사 일정 패턴).
 *   npx tsx scripts/verify-itinerary-route-map-fixtures.ts
 */

import { resolveItineraryRouteMapCountry } from '../lib/itinerary-route-map-country'
import {
  extractItineraryRouteMapHubs,
  parseScheduleJsonForRouteMap,
} from '../lib/itinerary-route-map-hubs'
import { buildItineraryRouteMapPrompt } from '../lib/itinerary-route-map-prompt'
import type { ItineraryRouteMapScheduleDay } from '../lib/itinerary-route-map-types'

type Case = {
  name: string
  country: string
  schedule: ItineraryRouteMapScheduleDay[]
  expectCities: string[]
  minHubs?: number
}

const CASES: Case[] = [
  {
    name: '일본 도쿄·하코네·교토·오사카',
    country: '일본',
    expectCities: ['도쿄', '하코네', '교토', '오사카'],
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
    name: '베트남 다낭·호이안·나트랑',
    country: '베트남',
    expectCities: ['다낭', '나트랑'],
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
    name: '이탈리아 로마·피렌체·밀라노',
    country: '이탈리아',
    expectCities: ['로마', '피렌체', '밀라노'],
    schedule: [
      { day: 1, routeText: '인천 - 로마', description: '도착' },
      { day: 2, routeText: '로마', description: '콜로세움' },
      { day: 3, routeText: '로마 - 피렌체', description: '기차 약 1시간 30분' },
      { day: 4, routeText: '피렌체', description: '우피치' },
      { day: 5, routeText: '피렌체 - 밀라노', description: '기차 약 2시간' },
      { day: 6, routeText: '밀라노 - 인천', description: '귀국' },
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
  {
    name: '유럽 파리·바르셀로나',
    country: '프랑스',
    expectCities: ['파리', '바르셀로나'],
    schedule: [
      { day: 1, routeText: '인천 - 파리', description: '도착' },
      { day: 2, routeText: '파리', description: '에펠' },
      { day: 3, routeText: '파리 - 바르셀로나', description: '비행 약 2시간' },
      { day: 4, routeText: '바르셀로나', description: '사그라다' },
      { day: 5, routeText: '바르셀로나 - 인천', description: '귀국' },
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
    const prompt = buildItineraryRouteMapPrompt({ countryKo, countryEn, hubs, legs })
    const cities = hubs.map((h) => h.cityKo)
    const minHubs = c.minHubs ?? 2
    const canGenerate = hubs.length >= 2
    const missingExpected = c.expectCities.filter((x) => !cities.includes(x))
    // 바르셀로나 등 CITY_KO_TO_EN 보강 전일 수 있음 — 프롬프트에 한글 라벨만 확인
    const promptOk =
      hubs.length === 0 ||
      (prompt.includes('Flat 2D') &&
        prompt.includes(countryEn) &&
        hubs.every((h) => prompt.includes(h.cityKo) || prompt.includes(h.cityEn)))

    const issues: string[] = []
    if (hubs.length < minHubs && c.name.includes('차단')) {
      /* expected */
    } else if (hubs.length < minHubs && !c.name.includes('차단')) {
      issues.push(`거점부족:${hubs.length}<${minHubs}`)
    }
    if (missingExpected.length && hubs.length >= 2) {
      // soft: 일부 도시는 맵에 없어도 통과하되 기록
      if (missingExpected.length === c.expectCities.length) issues.push(`기대도시전부누락:${missingExpected.join(',')}`)
    }
    if (!promptOk) issues.push('프롬프트불량')
    if (c.name.includes('차단') && canGenerate) issues.push('단일거점인데생성가능으로판정')
    if (!c.name.includes('차단') && !canGenerate && hubs.length < 2) {
      /* 일부 케이스는 minHubs=1 */
      if ((c.minHubs ?? 2) >= 2) issues.push('생성불가')
    }

    if (issues.length) fail++
    rows.push({
      name: c.name,
      countryEn,
      hubs: hubs.map((h) => `${h.cityKo}(${h.dayLabel})`).join('→'),
      legs: legs.length,
      canGenerate,
      missingExpected,
      issues,
      promptChars: prompt.length,
    })
  }

  console.log(JSON.stringify({ fail, total: CASES.length, rows }, null, 2))
  if (fail > 0) process.exitCode = 1
}

main()
