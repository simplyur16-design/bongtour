/**
 * publicDetailPayloadJson 전수 백업 — backfill/cron 재빌드 전 필수.
 *   npm run db:backup-detail-payload
 *   npm run db:backup-detail-payload -- --origin ybtour --listing air_hotel_free
 */
import dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: '.env.local', override: true })

async function main(): Promise<void> {
  const { prisma } = await import('../lib/prisma')

  const args = process.argv.slice(2)
  const originIdx = args.indexOf('--origin')
  const origin = originIdx >= 0 ? args[originIdx + 1]?.trim() : null
  const listingIdx = args.indexOf('--listing')
  const listing = listingIdx >= 0 ? args[listingIdx + 1]?.trim() : null

  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      publicDetailPayloadJson: { not: null },
      ...(origin ? { originSource: origin } : {}),
      ...(listing ? { listingKind: listing } : {}),
    },
    select: { id: true, slug: true },
  })

  const now = new Date()
  let n = 0
  for (const { id } of rows) {
    const cur = await prisma.product.findUnique({
      where: { id },
      select: { publicDetailPayloadJson: true, publicDetailPayloadJsonBackup: true },
    })
    if (!cur?.publicDetailPayloadJson?.trim()) continue
    if (cur.publicDetailPayloadJsonBackup?.trim()) continue
    await prisma.product.update({
      where: { id },
      data: {
        publicDetailPayloadJsonBackup: cur.publicDetailPayloadJson,
        publicDetailPayloadJsonBackupAt: now,
      },
    })
    n += 1
  }

  console.log(`[backup-detail-payload] copied ${n} / ${rows.length} products (skip if backup already set)`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
