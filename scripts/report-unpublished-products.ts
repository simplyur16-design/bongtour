/**
 * 비공개(registered 아님) 상품 48건 사유 리포트.
 * npx tsx scripts/report-unpublished-products.ts
 */
import './load-env-for-scripts'
import { PrismaClient } from '@prisma/client'
import { OVERSEAS_TRAINING_LISTING_KIND } from '@/lib/overseas-training-program-query'

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const rows = await prisma.product.findMany({
    where: { registrationStatus: { not: 'registered' } },
    orderBy: [{ registrationStatus: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      originCode: true,
      originSource: true,
      title: true,
      listingKind: true,
      registrationStatus: true,
      rejectReason: true,
      rejectedAt: true,
      noFutureDepartureConfirmedAt: true,
      lastFutureDepartureDate: true,
      updatedAt: true,
    },
  })

  const byStatus = new Map<string, typeof rows>()
  for (const p of rows) {
    const s = p.registrationStatus ?? '(null)'
    const arr = byStatus.get(s) ?? []
    arr.push(p)
    byStatus.set(s, arr)
  }

  console.log('=== 비공개 상품 리포트 ===')
  console.log('총', rows.length, '건 (registered 제외)')
  for (const [status, list] of [...byStatus.entries()].sort()) {
    console.log(`\n## ${status}: ${list.length}건`)
    for (const p of list) {
      const kind =
        p.listingKind === OVERSEAS_TRAINING_LISTING_KIND ? ' [프로그램]' : ''
      const reason =
        p.registrationStatus === 'rejected' && p.rejectReason
          ? ` | 반려사유: ${p.rejectReason}`
          : p.registrationStatus === 'auto_unpublished'
            ? ' | 공급사 SD1·출발 없음 등 자동 비공개'
            : ''
      const dep =
        p.lastFutureDepartureDate == null
          ? ' | 미래출발일 없음'
          : ` | lastFuture=${p.lastFutureDepartureDate.toISOString().slice(0, 10)}`
      console.log(
        `- ${p.slug ?? p.originCode ?? p.id} | ${p.originSource}${kind}${reason}${dep}`,
      )
      console.log(`  ${p.title.slice(0, 80)}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
