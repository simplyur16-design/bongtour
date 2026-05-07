/**
 * D-4 수동 검증: 해외·등록 상품 freshness 분포 + 자동 비공개 대상 (옵션 드라이런).
 *
 *   npx tsx scripts/run-price-freshness-once.ts [--skip-notify]
 *
 * --skip-notify: DB auto_unpublish 업데이트 및 Solapi 생략, 로그만.
 */
import type { PriceFreshnessLabel } from '@/lib/product-price-freshness'

async function main() {
  const { loadEnvConfig } = await import('@next/env')
  loadEnvConfig(process.cwd())

  const { prisma } = await import('@/lib/prisma')
  const { autoUnpublishStaleProducts, priceFreshnessLabel } = await import('@/lib/product-price-freshness')

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

  const staleAllRegistered = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      OR: [
        { lastPriceObservedAt: null, createdAt: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } },
        { lastPriceObservedAt: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } },
      ],
    },
    select: { id: true },
  })

  console.log('[price-freshness-once] registered·overseas count:', overseasRegistered.length)
  console.log('[price-freshness-once] freshness distribution:', JSON.stringify(dist))
  console.log('[price-freshness-once] auto-unpublish candidates (all registered):', staleAllRegistered.length)
  if (staleAllRegistered.length > 0 && staleAllRegistered.length <= 50) {
    console.log('[price-freshness-once] candidate ids:', staleAllRegistered.map((x) => x.id).join(','))
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
