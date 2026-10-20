/**
 * 등록·등록대기 상품 일정 동선 플랫 지도 일괄 생성.
 *
 * Usage:
 *   npx tsx scripts/generate-itinerary-route-maps.ts
 *   npx tsx scripts/generate-itinerary-route-maps.ts --apply
 *   npx tsx scripts/generate-itinerary-route-maps.ts --apply --force --limit=20
 *   npx tsx scripts/generate-itinerary-route-maps.ts --apply --status=registered
 */

import './load-env'
import { prisma } from '../lib/prisma'
import { generateAndPersistItineraryRouteMap } from '../lib/itinerary-route-map-generate'
import {
  extractItineraryRouteMapHubs,
  parseScheduleJsonForRouteMap,
} from '../lib/itinerary-route-map-hubs'
import { getItineraryRouteMapFromRawMeta } from '../lib/itinerary-route-map-raw-meta'

function argFlag(name: string): boolean {
  return process.argv.includes(name)
}

function argValue(name: string): string | null {
  const pref = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(pref))
  return hit ? hit.slice(pref.length) : null
}

async function main() {
  const apply = argFlag('--apply')
  const force = argFlag('--force')
  const limit = Math.max(1, Number(argValue('--limit') ?? '250') || 250)
  const statusFilter = argValue('--status') // registered | pending | all

  const statusOr =
    statusFilter === 'registered'
      ? [{ registrationStatus: 'registered' }]
      : statusFilter === 'pending'
        ? [{ registrationStatus: 'pending' }, { registrationStatus: null }, { registrationStatus: '' }]
        : [
            { registrationStatus: 'registered' },
            { registrationStatus: 'pending' },
            { registrationStatus: null },
            { registrationStatus: '' },
          ]

  // ready 후보를 충분히 긁기 위해 페이지네이션
  const pageSize = 200
  const ready: Array<{
    id: string
    title: string | null
    registrationStatus: string | null
  }> = []
  let cursor: string | undefined

  while (ready.length < limit) {
    const rows = await prisma.product.findMany({
      where: {
        OR: statusOr,
        schedule: { not: null },
      },
      select: {
        id: true,
        title: true,
        registrationStatus: true,
        rawMeta: true,
        schedule: true,
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1]!.id

    for (const r of rows) {
      if (!force && getItineraryRouteMapFromRawMeta(r.rawMeta)?.url) continue
      const { hubs } = extractItineraryRouteMapHubs(parseScheduleJsonForRouteMap(r.schedule))
      if (hubs.length < 2) continue
      ready.push({
        id: r.id,
        title: r.title,
        registrationStatus: r.registrationStatus,
      })
      if (ready.length >= limit) break
    }
    if (rows.length < pageSize) break
  }

  console.log(
    `[itinerary-route-map] ready=${ready.length} apply=${apply} force=${force} status=${statusFilter ?? 'all'}`,
  )

  let ok = 0
  let skip = 0
  let fail = 0

  for (const row of ready) {
    const label = `${row.id} (${row.registrationStatus ?? 'null'}) ${String(row.title ?? '').slice(0, 40)}`
    if (!apply) {
      console.log(`[dry-run] ${label}`)
      continue
    }
    try {
      const result = await generateAndPersistItineraryRouteMap(prisma, row.id, { force })
      if (!result.ok) {
        fail++
        console.warn(`[fail] ${label}: ${result.error}`)
        continue
      }
      if (result.skipped) {
        skip++
        console.log(`[skip] ${label}`)
      } else {
        ok++
        console.log(`[ok] ${label} → ${result.meta.url}`)
      }
    } catch (e) {
      fail++
      console.warn(`[fail] ${label}:`, e instanceof Error ? e.message : e)
    }
  }

  console.log(`[done] ok=${ok} skip=${skip} fail=${fail} dryRun=${!apply}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
