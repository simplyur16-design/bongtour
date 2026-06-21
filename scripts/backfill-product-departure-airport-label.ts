/**
 * registered 해외 상품 — departureAirportLabel + localDepartureTag backfill.
 *
 *   npx tsx scripts/backfill-product-departure-airport-label.ts --dry-run
 *   npx tsx scripts/backfill-product-departure-airport-label.ts --apply
 *   npx tsx scripts/backfill-product-departure-airport-label.ts --apply --all
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('[backfill-product-departure-airport-label] DIRECT_URL/DATABASE_URL 미로드')
  process.exit(1)
}

import { PrismaClient } from '@prisma/client'
import type { LocalDepartureTag } from '@/lib/product-listing-kind'
import {
  inferDepartureAirportFieldsFromStoredProduct,
  itineraryDaysToInferHaystack,
  shouldUpdateStoredDepartureAirportFields,
} from '@/lib/backfill-product-departure-airport'
import { homeDepartureAirportDisplayText } from '@/lib/infer-home-departure-airport'

const dryRun = process.argv.includes('--dry-run')
const apply = process.argv.includes('--apply')
const onlyFillMissing = !process.argv.includes('--all')

if (!dryRun && !apply) {
  console.error('Specify --dry-run or --apply')
  process.exit(1)
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
})

async function main() {
  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
    },
    select: {
      id: true,
      slug: true,
      originSource: true,
      airline: true,
      includedText: true,
      schedule: true,
      rawMeta: true,
      localDepartureTag: true,
      departureAirportLabel: true,
      itineraryDays: {
        select: {
          city: true,
          summaryTextRaw: true,
          transport: true,
          rawBlock: true,
        },
        orderBy: { day: 'asc' },
      },
    },
    orderBy: { slug: 'asc' },
  })

  let scanned = 0
  let candidates = 0
  let applied = 0
  const samples: string[] = []

  for (const p of products) {
    scanned += 1
    const existingTags = (p.localDepartureTag ?? []).filter(Boolean) as LocalDepartureTag[]
    const inferred = inferDepartureAirportFieldsFromStoredProduct({
      airline: p.airline,
      includedText: p.includedText,
      scheduleJson: p.schedule,
      itineraryHaystack: itineraryDaysToInferHaystack(p.itineraryDays),
      rawMeta: p.rawMeta,
      existingLocalDepartureTags: existingTags,
    })

    if (
      !shouldUpdateStoredDepartureAirportFields({
        currentLabel: p.departureAirportLabel,
        currentTags: p.localDepartureTag ?? [],
        inferred,
        onlyFillMissing,
      })
    ) {
      continue
    }

    candidates += 1
    const display = homeDepartureAirportDisplayText(inferred.departureAirportLabel)
    const line = `${p.slug} label=${p.departureAirportLabel ?? 'null'}→${inferred.departureAirportLabel ?? 'null'} display=${display ?? '-'} tags=${JSON.stringify(p.localDepartureTag ?? [])}→${JSON.stringify(inferred.localDepartureTag)}`
    if (samples.length < 40) samples.push(line)

    if (apply) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          departureAirportLabel: inferred.departureAirportLabel,
          localDepartureTag: inferred.localDepartureTag,
        },
      })
      applied += 1
    }
  }

  console.log(
    `[backfill-product-departure-airport-label] mode=${apply ? 'apply' : 'dry-run'} onlyFillMissing=${onlyFillMissing}`,
  )
  console.log(`scanned=${scanned} candidates=${candidates} applied=${applied}`)
  if (samples.length > 0) {
    console.log('\nSample updates:')
    for (const s of samples) console.log(`  ${s}`)
    if (candidates > samples.length) console.log(`  … +${candidates - samples.length} more`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
