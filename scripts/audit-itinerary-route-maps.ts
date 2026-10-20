/**
 * 등록·등록대기 상품 일정 동선 지도 감사 (생성 API 호출 없음).
 *   npx tsx scripts/audit-itinerary-route-maps.ts
 */

import './load-env'
import { prisma } from '../lib/prisma'
import { resolveItineraryRouteMapCountry } from '../lib/itinerary-route-map-country'
import {
  extractItineraryRouteMapHubs,
  parseScheduleJsonForRouteMap,
} from '../lib/itinerary-route-map-hubs'
import { buildItineraryRouteMapPrompt } from '../lib/itinerary-route-map-prompt'
import { getItineraryRouteMapFromRawMeta } from '../lib/itinerary-route-map-raw-meta'

type Bucket = {
  id: string
  status: string
  title: string
  hubs: number
  hubNames: string
  countryEn: string
  hasMap: boolean
  mapUrl: string
  reason: string
}

function byStatus(list: Bucket[]) {
  const m: Record<string, number> = {}
  for (const x of list) m[x.status] = (m[x.status] ?? 0) + 1
  return m
}

async function main() {
  const statusOr = [
    { registrationStatus: 'registered' },
    { registrationStatus: 'pending' },
    { registrationStatus: null },
    { registrationStatus: '' },
  ]

  const rows = await prisma.product.findMany({
    where: { OR: statusOr },
    select: {
      id: true,
      title: true,
      registrationStatus: true,
      country: true,
      destination: true,
      primaryDestination: true,
      schedule: true,
      rawMeta: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  const withMap: Bucket[] = []
  const ready: Bucket[] = []
  const blocked: Bucket[] = []
  const noSchedule: Bucket[] = []

  for (const r of rows) {
    const status = r.registrationStatus ?? 'null'
    const title = String(r.title ?? '').slice(0, 50)
    const existing = getItineraryRouteMapFromRawMeta(r.rawMeta)
    const schedule = parseScheduleJsonForRouteMap(r.schedule)

    if (schedule.length === 0) {
      noSchedule.push({
        id: r.id,
        status,
        title,
        hubs: 0,
        hubNames: '',
        countryEn: '',
        hasMap: Boolean(existing?.url),
        mapUrl: existing?.url ?? '',
        reason: 'schedule 없음/파싱실패',
      })
      continue
    }

    const { hubs, legs } = extractItineraryRouteMapHubs(schedule)
    const { countryKo, countryEn } = resolveItineraryRouteMapCountry({
      country: r.country,
      destination: r.destination,
      primaryDestination: r.primaryDestination,
      title: r.title,
    })
    const base: Bucket = {
      id: r.id,
      status,
      title,
      hubs: hubs.length,
      hubNames: hubs.map((h) => `${h.cityKo}(${h.dayLabel})`).join('→'),
      countryEn,
      hasMap: Boolean(existing?.url),
      mapUrl: existing?.url ?? '',
      reason: '',
    }

    if (existing?.url) {
      withMap.push({ ...base, reason: '지도 URL 있음' })
      continue
    }
    if (hubs.length < 2) {
      blocked.push({
        ...base,
        reason: hubs.length === 0 ? '거점 0개' : '거점 1개(최소 2 필요)',
      })
      continue
    }

    const prompt = buildItineraryRouteMapPrompt({ countryKo, countryEn, hubs, legs })
    const missingCity = hubs.find((h) => !prompt.includes(h.cityKo))
    if (!prompt.includes('Flat 2D') || missingCity) {
      blocked.push({
        ...base,
        reason: missingCity ? `프롬프트 도시누락:${missingCity.cityKo}` : '프롬프트 형식오류',
      })
      continue
    }
    ready.push({ ...base, reason: '생성 가능(미생성)' })
  }

  console.log(
    JSON.stringify(
      {
        totals: {
          products: rows.length,
          withMap: withMap.length,
          readyToGenerate: ready.length,
          blockedHubs: blocked.length,
          noSchedule: noSchedule.length,
        },
        withMapByStatus: byStatus(withMap),
        readyByStatus: byStatus(ready),
        blockedByStatus: byStatus(blocked),
        noScheduleByStatus: byStatus(noSchedule),
        sampleReady: ready.slice(0, 10),
        sampleBlocked: blocked.slice(0, 15),
        sampleWithMap: withMap.slice(0, 5),
        sampleNoSchedule: noSchedule.slice(0, 8),
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
