/**
 * BongGlobalEvent → CurationEvent 일회성 이전 (PR 가-3).
 *
 * Usage:
 *   npx tsx scripts/migrate-bong-global-event-to-curation-event.ts
 */
import { prisma } from '@/lib/prisma'

async function migrateBongGlobalEventToCurationEvent() {
  const legacyEvents = await prisma.bongGlobalEvent.findMany({
    orderBy: [{ year: 'asc' }, { startMonth: 'asc' }, { name: 'asc' }],
  })
  console.log(`Found ${legacyEvents.length} BongGlobalEvent rows`)

  let migrated = 0
  let skipped = 0

  for (const legacy of legacyEvents) {
    const monthKey = `${legacy.year}-${String(legacy.startMonth).padStart(2, '0')}`

    const existing = await prisma.curationEvent.findUnique({
      where: {
        name_countryCode_year: {
          name: legacy.name,
          countryCode: legacy.country,
          year: legacy.year,
        },
      },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.curationEvent.create({
      data: {
        monthKey,
        countryCode: legacy.country,
        countryKey: null,
        name: legacy.name,
        city: legacy.city,
        startMonth: legacy.startMonth,
        startDay: legacy.startDay,
        endMonth: legacy.endMonth,
        endDay: legacy.endDay,
        type: legacy.type,
        description: legacy.description,
        appealReason: legacy.appealReason,
        year: legacy.year,
        source: legacy.source ?? 'gemini',
        status: 'approved',
        marketingOnly: true,
        collectedAt: legacy.collectedAt,
      },
    })
    migrated++
  }

  console.log(`Migrated: ${migrated}, Skipped: ${skipped}`)
}

migrateBongGlobalEventToCurationEvent()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
