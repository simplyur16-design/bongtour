import './load-env-for-scripts'
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })
  const rows = await prisma.product.findMany({
    where: { registrationStatus: { not: 'registered' } },
    select: {
      slug: true,
      originCode: true,
      originSource: true,
      title: true,
      registrationStatus: true,
      rejectReason: true,
      autoUnpublishedReason: true,
      lastFutureDepartureDate: true,
      listingKind: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  const au = rows.filter((r) => r.registrationStatus === 'auto_unpublished')
  const rej = rows.filter((r) => r.registrationStatus === 'rejected')
  const bySrc = new Map<string, number>()
  const byReason = new Map<string, number>()
  for (const r of au) {
    bySrc.set(r.originSource, (bySrc.get(r.originSource) ?? 0) + 1)
    const reason = r.autoUnpublishedReason ?? '(none)'
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1)
  }

  console.log(JSON.stringify({
    total: rows.length,
    autoUnpublished: au.length,
    rejected: rej.length,
    autoUnpublishedBySupplier: Object.fromEntries(bySrc),
    autoUnpublishedByReason: Object.fromEntries(byReason),
    autoUnpublishedNoFutureDeparture: au.filter((r) => r.lastFutureDepartureDate == null).length,
    rejectedReasons: rej.map((r) => ({
      id: r.slug ?? r.originCode,
      reason: r.rejectReason ?? null,
      title: r.title.slice(0, 60),
    })),
  }, null, 2))

  await prisma.$disconnect()
}

main()
