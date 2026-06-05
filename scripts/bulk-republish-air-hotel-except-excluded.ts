/**
 * 자유여행(air_hotel_free) — auto_unpublished 일괄 registered 전환.
 *
 * 제외:
 *   - registrationStatus = rejected
 *   - autoUnpublishedReason = marker_revalidated_no_future_departure_manual
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/bulk-republish-air-hotel-except-excluded.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/bulk-republish-air-hotel-except-excluded.ts --apply
 */
import { prisma } from '@/lib/prisma'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'

const EXCLUDED_REASON = 'marker_revalidated_no_future_departure_manual'

async function main() {
  const apply = process.argv.includes('--apply')

  const candidates = await prisma.product.findMany({
    where: {
      listingKind: 'air_hotel_free',
      registrationStatus: 'auto_unpublished',
      OR: [
        { autoUnpublishedReason: null },
        { autoUnpublishedReason: { not: EXCLUDED_REASON } },
      ],
    },
    select: {
      id: true,
      title: true,
      originSource: true,
      autoUnpublishedReason: true,
      autoUnpublishedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        targetCount: candidates.length,
        excludedReasonSkipped: EXCLUDED_REASON,
        byReason: candidates.reduce(
          (acc, p) => {
            const k = p.autoUnpublishedReason ?? '(null)'
            acc[k] = (acc[k] ?? 0) + 1
            return acc
          },
          {} as Record<string, number>,
        ),
        samples: candidates.slice(0, 8).map((p) => ({
          id: p.id,
          title: p.title.slice(0, 72),
          originSource: p.originSource,
          autoUnpublishedReason: p.autoUnpublishedReason,
        })),
      },
      null,
      2,
    ),
  )

  if (!apply) {
    console.log('\n[dry-run] 적용하려면 --apply 플래그를 붙이세요.')
    return
  }

  if (candidates.length === 0) {
    console.log('\n[apply] 대상 없음.')
    return
  }

  const ids = candidates.map((p) => p.id)
  const updated = await prisma.product.updateMany({
    where: { id: { in: ids } },
    data: {
      registrationStatus: 'registered',
      autoUnpublishedAt: null,
      autoUnpublishedReason: null,
    },
  })

  try {
    revalidateProductListingCaches()
  } catch (e) {
    console.warn('[apply] revalidateProductListingCaches skipped (non-Next context):', e)
  }

  console.log(`\n[apply] registered 전환 완료: ${updated.count}건`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
