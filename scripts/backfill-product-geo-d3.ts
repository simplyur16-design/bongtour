/**
 * D-3 백필: 등록 상품 `country`/`city` 한글 SSOT + 키·continent 재추론 (`normalizeProductGeoForPrisma`).
 *
 *   npx tsx scripts/backfill-product-geo-d3.ts           # dry-run (기본)
 *   npx tsx scripts/backfill-product-geo-d3.ts --apply   # DB 반영 — 운영자 승인 후에만
 *
 * 국내(`travelScope === 'domestic'`) 상품은 스킵(해외 browse·메가메뉴 SSOT 대상 아님).
 */
import './load-env-for-scripts'

import { normalizeProductGeoForPrisma } from '@/lib/normalize-product-geo'
import { parseTravelScope } from '@/lib/product-listing-kind'
import { prisma } from '@/lib/prisma'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'

function bodyTextFromSchedule(schedule: string | null): string | null {
  if (!schedule?.trim()) return null
  const rows = getScheduleFromProduct({ schedule })
  const t = rows
    .map((d) => [d.title, d.description].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n')
  return t.length ? t : null
}

const GEO_FIELDS = [
  'country',
  'city',
  'countryKey',
  'nodeKey',
  'groupKey',
  'continent',
  'locationMatchConfidence',
  'locationMatchSource',
] as const

async function main() {
  const apply = process.argv.includes('--apply')

  const rows = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: {
      id: true,
      title: true,
      originSource: true,
      destination: true,
      destinationRaw: true,
      primaryDestination: true,
      schedule: true,
      travelScope: true,
      country: true,
      city: true,
      countryKey: true,
      nodeKey: true,
      groupKey: true,
      continent: true,
      locationMatchConfidence: true,
      locationMatchSource: true,
    },
  })

  let domesticSkipped = 0
  const patches: Array<{ id: string; before: Record<string, unknown>; after: Record<string, unknown> }> = []

  for (const r of rows) {
    if (parseTravelScope(r.travelScope ?? undefined) === 'domestic') {
      domesticSkipped++
      continue
    }

    const bodyText = bodyTextFromSchedule(r.schedule)
    const next = normalizeProductGeoForPrisma({
      title: r.title ?? '',
      originSource: r.originSource ?? '',
      destination: r.destination,
      destinationRaw: r.destinationRaw,
      primaryDestination: r.primaryDestination,
      bodyText,
      browseHintCountry: r.country,
      browseHintCity: r.city,
    })

    const before: Record<string, unknown> = {}
    let diff = false
    for (const k of GEO_FIELDS) {
      const oldV = (r as Record<string, unknown>)[k] ?? null
      const newV = (next as Record<string, unknown>)[k] ?? null
      before[k] = oldV
      if (oldV !== newV) diff = true
    }
    if (diff) {
      const after: Record<string, unknown> = {}
      for (const k of GEO_FIELDS) after[k] = (next as Record<string, unknown>)[k] ?? null
      patches.push({ id: r.id, before, after })
    }
  }

  console.log(
    JSON.stringify(
      {
        registeredScanned: rows.length,
        domesticSkipped,
        wouldUpdate: patches.length,
        apply,
      },
      null,
      2,
    ),
  )
  for (const p of patches.slice(0, 80)) {
    console.log(JSON.stringify({ id: p.id, before: p.before, after: p.after }))
  }
  if (patches.length > 80) console.log('[truncated stdout]', patches.length - 80, 'more rows')

  if (apply && patches.length > 0) {
    for (const p of patches) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          country: p.after.country as string | null,
          city: p.after.city as string | null,
          countryKey: p.after.countryKey as string | null,
          nodeKey: p.after.nodeKey as string | null,
          groupKey: p.after.groupKey as string | null,
          continent: p.after.continent as string | null,
          locationMatchConfidence: p.after.locationMatchConfidence as string | null,
          locationMatchSource: p.after.locationMatchSource as string | null,
        },
      })
    }
    console.log('[apply] updated', patches.length, 'rows')
  } else if (!apply && patches.length > 0) {
    console.log('[dry-run] 승인 후 `npx tsx scripts/backfill-product-geo-d3.ts --apply` 로 반영')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
