/**
 * modetour_sd1 자동 비공개 상품 중 **오늘 이후 성인가 > 0 출발일이 DB에 남아 있는 것만** registered 복구.
 *
 * npx tsx scripts/ops-republish-modetour-sd1-with-future-deps.ts
 * npx tsx scripts/ops-republish-modetour-sd1-with-future-deps.ts --apply
 */
import './load-env-for-scripts'
import { PrismaClient } from '@prisma/client'
import {
  futurePricedDepartureWhere,
  MODETOUR_SD1_AUTO_UNPUBLISH_REASON,
} from '@/lib/modetour-sd1-policy'
import { kstTodayYmd } from '@/lib/product-sales-policy'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'

async function main() {
  const apply = process.argv.includes('--apply')
  const todayYmd = kstTodayYmd()
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const candidates = await prisma.product.findMany({
    where: {
      registrationStatus: 'auto_unpublished',
      autoUnpublishedReason: MODETOUR_SD1_AUTO_UNPUBLISH_REASON,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      originSource: true,
      listingKind: true,
      autoUnpublishedAt: true,
      hasBookableDepartures: true,
      minBookableAdultPrice: true,
    },
    orderBy: { autoUnpublishedAt: 'desc' },
  })

  const withFuture: typeof candidates = []
  const withoutFuture: typeof candidates = []

  for (const p of candidates) {
    const n = await prisma.productDeparture.count({
      where: futurePricedDepartureWhere(p.id, todayYmd),
    })
    if (n > 0) withFuture.push(p)
    else withoutFuture.push(p)
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        todayYmd,
        modetour_sd1_auto_unpublished_total: candidates.length,
        republish_with_future_priced_departures: withFuture.length,
        keep_unpublished_no_future_priced_departures: withoutFuture.length,
        republish_samples: withFuture.slice(0, 12).map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title.slice(0, 70),
          hasBookableDepartures: p.hasBookableDepartures,
          minBookableAdultPrice: p.minBookableAdultPrice,
        })),
        keep_unpublished_samples: withoutFuture.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title.slice(0, 70),
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

  if (withFuture.length > 0) {
    const updated = await prisma.product.updateMany({
      where: { id: { in: withFuture.map((p) => p.id) } },
      data: {
        registrationStatus: 'registered',
        autoUnpublishedAt: null,
        autoUnpublishedReason: null,
      },
    })
    console.log(`[apply] registered 복구: ${updated.count}건`)
  }

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
