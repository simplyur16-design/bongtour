/**
 * D-4 수동 검증: 해외·등록 상품 freshness 분포 + 자동 비공개 대상 (옵션 드라이런).
 *
 *   npx tsx scripts/run-price-freshness-once.ts [--skip-notify]
 *
 * --skip-notify: DB auto_unpublish 업데이트 및 Solapi 생략, 로그만.
 *
 * 자동 비공개 후보는 `findAutoUnpublishPriceStaleProductIds`와 동일(ProductDeparture.syncedAt·Product.createdAt 기준).
 * 분포 라벨에서 `lastPriceObservedAt` 이 비었을 때 보조 인자는 Product.createdAt만 사용(자식 테이블 createdAt 없음).
 */
import type { PriceFreshnessLabel } from '@/lib/product-price-freshness'

async function main() {
  const { loadEnvConfig } = await import('@next/env')
  loadEnvConfig(process.cwd())

  const { prisma } = await import('@/lib/prisma')
  const {
    autoUnpublishStaleProducts,
    findAutoUnpublishPriceStaleProductIds,
    priceFreshnessLabel,
  } = await import('@/lib/product-price-freshness')

  const skipNotify = process.argv.includes('--skip-notify')

  const overseasRegistered = await prisma.product.findMany({
    where: { registrationStatus: 'registered', travelScope: 'overseas' },
    select: { id: true, lastPriceObservedAt: true, createdAt: true },
  })

  const dist: Record<PriceFreshnessLabel, number> = {
    fresh_7d: 0,
    stale_30d: 0,
    stale_90d: 0,
    archive_pending: 0,
    unknown: 0,
  }
  for (const r of overseasRegistered) {
    dist[priceFreshnessLabel(r.lastPriceObservedAt, r.createdAt)]++
  }

  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  const staleAllRegistered = await findAutoUnpublishPriceStaleProductIds(prisma, cutoff)

  console.log('[price-freshness-once] registered·overseas count:', overseasRegistered.length)
  console.log('[price-freshness-once] freshness distribution:', JSON.stringify(dist))
  console.log('[price-freshness-once] auto-unpublish candidates (all registered):', staleAllRegistered.length)
  if (staleAllRegistered.length > 0 && staleAllRegistered.length <= 50) {
    console.log('[price-freshness-once] candidate ids:', staleAllRegistered.join(','))
  }

  const r = await autoUnpublishStaleProducts(prisma, { dryRun: skipNotify })
  console.log(
    '[price-freshness-once] autoUnpublishStaleProducts:',
    JSON.stringify({
      dryRun: r.dryRun,
      candidates: r.candidateIds.length,
      updatedCount: r.updatedCount,
      notifyAttempted: r.notifyAttempted,
      notifyOk: r.notifyOk,
      notifyMessage: r.notifyMessage ?? null,
    })
  )

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
