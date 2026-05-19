/**
 * registered 상품 ProductCountryTag·ProductCityTag 백필 (태그 없는 상품 → syncProductGeoTags).
 * 실행: npx tsx scripts/backfill-product-country-tag.ts
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'
loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('[backfill-product-country-tag] DIRECT_URL/DATABASE_URL 둘 다 미로드')
  process.exit(1)
}

import { PrismaClient } from '@prisma/client'
import type { ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'
import { syncProductGeoTags } from '@/lib/sync-product-geo-tags'

const dbUrl = process.env.DATABASE_URL
const directUrl = process.env.DIRECT_URL
console.log('[diag] DATABASE_URL prefix:', dbUrl?.substring(0, 15))
console.log('[diag] DIRECT_URL prefix:', directUrl?.substring(0, 15))
console.log('[diag] using:', directUrl ? 'DIRECT_URL' : 'DATABASE_URL')

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

async function backfillMissingTags(): Promise<void> {
  const registered = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: { id: true },
  })
  const registeredIds = registered.map((r) => r.id)

  const withTags = await prisma.productCountryTag.findMany({
    where: { productId: { in: registeredIds } },
    select: { productId: true },
    distinct: ['productId'],
  })
  const tagged = new Set(withTags.map((r) => r.productId))
  const missingIds = registeredIds.filter((id) => !tagged.has(id))

  const total = missingIds.length
  console.log(`[backfill-product-country-tag] registered=${registeredIds.length} missingTags=${total}`)
  if (total === 0) return

  let processed = 0
  let taggedCount = 0
  let skippedNoCountry = 0

  for (let offset = 0; offset < missingIds.length; offset += BATCH_SIZE) {
    const batchIds = missingIds.slice(offset, offset + BATCH_SIZE)
    const batch = await prisma.product.findMany({
      where: { id: { in: batchIds } },
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
      },
    })

    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        if (!row.countryKey?.trim()) {
          skippedNoCountry += 1
          processed += 1
          continue
        }
        const geo = toGeo(row)
        const { country, cityTagCount } = await syncProductGeoTags(tx, row.id, geo, {
          title: row.title,
          primaryDestination: row.primaryDestination,
          destinationRaw: row.destinationRaw,
        })
        if (country.tagCount > 0 || cityTagCount > 0) taggedCount += 1
        processed += 1
      }
    })

    const pct = Math.min(100, Math.round((processed / total) * 100))
    console.log(`[backfill-product-country-tag] ${processed}/${total} (${pct}%)`)
  }

  console.log(
    `[backfill-product-country-tag] done processed=${processed} tagged=${taggedCount} skippedNoCountryKey=${skippedNoCountry}`,
  )
}

async function main(): Promise<void> {
  await backfillMissingTags()
}

main()
  .catch((e) => {
    console.error('[backfill-product-country-tag] fatal', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
