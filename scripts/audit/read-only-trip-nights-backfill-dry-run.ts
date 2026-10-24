/**
 * READ ONLY — count registered products that would get tripNights/tripDays if backfilled.
 * Does not write. docs/audit/2026-10-24/trip-nights-backfill-dry-run.json
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { deriveTripNightsDays } from '@/lib/derive-trip-nights-days'
import { databaseHostOnly, withReadOnlyPrisma } from './read-only-prisma'

async function main() {
  const host = databaseHostOnly()
  console.log(`[audit] DB host=${host.host}`)

  const out = await withReadOnlyPrisma(async (tx) => {
    const rows = await tx.product.findMany({
      where: { registrationStatus: 'registered' },
      select: {
        id: true,
        slug: true,
        title: true,
        duration: true,
        tripNights: true,
        tripDays: true,
        schedule: true,
      },
      take: 5000,
    })

    let wouldFill = 0
    let alreadyFilled = 0
    let stillNull = 0
    const samples: Array<{ slug: string | null; before: unknown; after: unknown }> = []

    for (const r of rows) {
      if (r.tripNights != null && r.tripDays != null) {
        alreadyFilled++
        continue
      }
      let scheduleDayCount: number | null = null
      if (r.schedule) {
        try {
          const arr = JSON.parse(r.schedule) as unknown
          if (Array.isArray(arr)) scheduleDayCount = arr.length
        } catch {
          scheduleDayCount = null
        }
      }
      const derived = deriveTripNightsDays({
        duration: r.duration,
        title: r.title,
        scheduleDayCount,
      })
      if (derived.tripNights != null && derived.tripDays != null) {
        wouldFill++
        if (samples.length < 15) {
          samples.push({
            slug: r.slug,
            before: { tripNights: r.tripNights, tripDays: r.tripDays, duration: r.duration },
            after: derived,
          })
        }
      } else {
        stillNull++
      }
    }

    return {
      scanned: rows.length,
      alreadyFilled,
      wouldFillIfBackfill: wouldFill,
      stillNullAfterDerive: stillNull,
      samples,
    }
  })

  const path = join(process.cwd(), 'docs/audit/2026-10-24/trip-nights-backfill-dry-run.json')
  mkdirSync(join(process.cwd(), 'docs/audit/2026-10-24'), { recursive: true })
  writeFileSync(
    path,
    JSON.stringify({ generatedAt: new Date().toISOString(), host: host.host, ...out }, null, 2),
    'utf8',
  )
  console.log(JSON.stringify(out, null, 2))
  console.log(`[audit] wrote ${path}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
