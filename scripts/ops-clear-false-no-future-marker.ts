/**
 * `noFutureDepartureConfirmedAt`가 붙었지만 DB에 미래 성인가 출발이 남아 있는 상품 — 마커 해제·lastFutureDepartureDate 복구.
 *
 * npx tsx scripts/ops-clear-false-no-future-marker.ts
 * npx tsx scripts/ops-clear-false-no-future-marker.ts --apply
 */
import './load-env-for-scripts'
import { PrismaClient } from '@prisma/client'
import {
  futurePricedDepartureWhere,
  maxFuturePricedDepartureDate,
  productHasFuturePricedDeparture,
} from '@/lib/future-priced-departure-guard'
import { kstTodayYmd } from '@/lib/product-sales-policy'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'

async function main() {
  const apply = process.argv.includes('--apply')
  const todayYmd = kstTodayYmd()
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const marked = await prisma.product.findMany({
    where: { noFutureDepartureConfirmedAt: { not: null } },
    select: {
      id: true,
      slug: true,
      title: true,
      originSource: true,
      noFutureDepartureConfirmedAt: true,
      lastFutureDepartureDate: true,
    },
    orderBy: { noFutureDepartureConfirmedAt: 'desc' },
  })

  const toFix: Array<{
    id: string
    slug: string | null
    title: string
    originSource: string | null
    futurePriced: number
    lastFuture: Date | null
  }> = []

  for (const p of marked) {
    const futurePriced = await prisma.productDeparture.count({
      where: futurePricedDepartureWhere(p.id, todayYmd),
    })
    if (futurePriced <= 0) continue
    const lastFuture = await maxFuturePricedDepartureDate(prisma, p.id, todayYmd)
    toFix.push({
      id: p.id,
      slug: p.slug,
      title: p.title,
      originSource: p.originSource,
      futurePriced,
      lastFuture,
    })
  }

  const byOrigin = toFix.reduce(
    (acc, p) => {
      const k = p.originSource ?? '(null)'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        todayYmd,
        marked_total: marked.length,
        false_marker_with_db_future_priced: toFix.length,
        by_originSource: byOrigin,
        samples: toFix.slice(0, 15).map((p) => ({
          slug: p.slug,
          title: p.title.slice(0, 60),
          originSource: p.originSource,
          futurePriced: p.futurePriced,
          lastFuture: p.lastFuture?.toISOString().slice(0, 10) ?? null,
        })),
      },
      null,
      2,
    ),
  )

  if (!apply) {
    console.log('\n[dry-run] --apply 로 실제 반영')
    await prisma.$disconnect()
    return
  }

  let fixed = 0
  for (const p of toFix) {
    const hasFuture = await productHasFuturePricedDeparture(prisma, p.id, todayYmd)
    if (!hasFuture) continue
    const lastFuture = await maxFuturePricedDepartureDate(prisma, p.id, todayYmd)
    await prisma.product.update({
      where: { id: p.id },
      data: {
        noFutureDepartureConfirmedAt: null,
        lastFutureDepartureDate: lastFuture,
      },
    })
    fixed += 1
  }

  console.log(`[apply] 마커 해제·lastFutureDepartureDate 복구: ${fixed}건`)

  try {
    revalidateProductListingCaches()
  } catch {
    /* non-Next context */
  }

  await prisma.$disconnect()
  console.log('[apply] 완료')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
