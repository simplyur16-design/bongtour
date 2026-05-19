/**
 * registered 해외 상품 — ProductCityTag 누락·클러스터 다도시 태그 재동기화.
 * 실행: npx tsx scripts/backfill-product-city-tag.ts
 *       npx tsx scripts/backfill-product-city-tag.ts --dry-run
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('[backfill-product-city-tag] DIRECT_URL/DATABASE_URL 미로드')
  process.exit(1)
}

import { PrismaClient } from '@prisma/client'
import type { ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'
import { syncProductGeoTags } from '@/lib/sync-product-geo-tags'

const dryRun = process.argv.includes('--dry-run')

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
})

const BATCH_SIZE = 50

function toGeo(row: {
  countryKey: string | null
  nodeKey: string | null
  groupKey: string | null
  locationMatchConfidence: string | null
  locationMatchSource: string | null
  continent: string | null
  continentKey: string | null
  cityKey: string | null
  country: string | null
  city: string | null
}): ProductLocationKeyPrismaFields {
  return {
    countryKey: row.countryKey,
    nodeKey: row.nodeKey,
    groupKey: row.groupKey,
    locationMatchConfidence: row.locationMatchConfidence,
    locationMatchSource: row.locationMatchSource,
    continent: row.continent,
    continentKey: row.continentKey,
    cityKey: row.cityKey,
    country: row.country,
    city: row.city,
  }
}

async function main(): Promise<void> {
  const resyncAll = process.argv.includes('--all-registered')

  const candidates = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      countryKey: { not: null },
      ...(resyncAll ? {} : { cityKey: { not: null } }),
    },
    select: {
      id: true,
      title: true,
      primaryDestination: true,
      destinationRaw: true,
      countryKey: true,
      nodeKey: true,
      groupKey: true,
      locationMatchConfidence: true,
      locationMatchSource: true,
      continent: true,
      continentKey: true,
      cityKey: true,
      country: true,
      city: true,
      cityTags: { select: { id: true }, take: 1 },
    },
  })

  const missing = resyncAll
    ? candidates
    : candidates.filter((p) => p.cityTags.length === 0)
  console.log(
    `[backfill-product-city-tag] targets=${missing.length} (pool=${candidates.length})${resyncAll ? ' --all-registered' : ''}${dryRun ? ' dry-run' : ''}`,
  )

  let applied = 0
  let skipped = 0

  for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
    const batch = missing.slice(offset, offset + BATCH_SIZE)
    for (const row of batch) {
      const geo = toGeo(row)
      if (dryRun) {
        console.log(`  [dry] ${row.id} cityKey=${row.cityKey}`)
        applied++
        continue
      }
      const { cityTagCount, cityKeys, cityKey } = await syncProductGeoTags(prisma, row.id, geo, {
        title: row.title,
        primaryDestination: row.primaryDestination,
        destinationRaw: row.destinationRaw,
      })
      if (cityTagCount > 0) {
        applied++
        console.log(`  [ok] ${row.id} → cityTags=${cityKeys.join(',')} primary=${cityKey}`)
      } else {
        skipped++
        console.log(`  [skip] ${row.id} node=${row.nodeKey} cityKey=${row.cityKey}`)
      }
    }
  }

  console.log(`[backfill-product-city-tag] done applied=${applied} skipped=${skipped}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
