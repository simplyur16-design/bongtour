/**
 * REGRESSION-FREEZE[register-destination-reject-ilju]: polluted destination DB heal — manifest
 *
 * 목록「지역」오염(일주·노쇼핑·출발확정·항공 안내 등) → title/countryKey로 교정.
 *
 *   npx tsx scripts/backfill-product-list-destination-heal.ts --dry-run
 *   npx tsx scripts/backfill-product-list-destination-heal.ts --apply
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'

loadEnv({ path: path.resolve(process.cwd(), '.env') })
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true })

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('[backfill-product-list-destination-heal] DIRECT_URL/DATABASE_URL 미로드')
  process.exit(1)
}

import { PrismaClient } from '@prisma/client'
import {
  finalizeRegisterDestinationFields,
  isRegisterDestinationPollutionLabel,
} from '@/lib/register-destination-finalize'

const dryRun = process.argv.includes('--dry-run')
const apply = process.argv.includes('--apply')

if (!dryRun && !apply) {
  console.error('Specify --dry-run or --apply')
  process.exit(1)
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
})

function needsHeal(fields: {
  destination: string | null
  destinationRaw: string | null
  primaryDestination: string | null
}): boolean {
  for (const v of [fields.primaryDestination, fields.destination, fields.destinationRaw]) {
    const t = String(v ?? '').trim()
    if (!t) continue
    if (isRegisterDestinationPollutionLabel(t)) return true
  }
  return false
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      originSource: true,
      title: true,
      destination: true,
      destinationRaw: true,
      primaryDestination: true,
      countryKey: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  let scanned = 0
  let candidates = 0
  let applied = 0
  let unhealable = 0
  const samples: Array<Record<string, string | null>> = []

  for (const p of products) {
    scanned += 1
    if (!needsHeal(p)) continue

    const next = finalizeRegisterDestinationFields({
      title: p.title,
      destination: p.destination,
      destinationRaw: p.destinationRaw,
      primaryDestination: p.primaryDestination,
      countryKey: p.countryKey,
    })

    const before = (p.primaryDestination || p.destination || p.destinationRaw || '').trim()
    const after = (next.primaryDestination || next.destination || '').trim()
    if (!after || after === before) {
      if (isRegisterDestinationPollutionLabel(before) || !after) {
        unhealable += 1
        if (samples.length < 40) {
          samples.push({
            id: p.id,
            origin: p.originSource,
            before,
            after: after || '(empty)',
            title: (p.title || '').slice(0, 80),
            note: 'unhealable',
          })
        }
      }
      continue
    }

    candidates += 1
    if (samples.length < 60) {
      samples.push({
        id: p.id,
        origin: p.originSource,
        before,
        after,
        title: (p.title || '').slice(0, 80),
        countryKey: p.countryKey,
      })
    }

    if (apply) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          destination: next.destination || null,
          destinationRaw: next.destinationRaw,
          primaryDestination: next.primaryDestination,
        },
      })
      applied += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        scanned,
        candidates,
        applied,
        unhealable,
        samples,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
