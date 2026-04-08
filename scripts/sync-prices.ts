/**
 * 매일 새벽 등록된 모든 상품의 가격을 본사 사이트와 대조해 자동 업데이트.
 * 실행: npx tsx scripts/sync-prices.ts  또는  npm run cron:sync
 * 환경변수: DATABASE_URL, (선택) HQ_PRODUCT_BASE_URL
 */
import { PrismaClient } from '@prisma/client'
import { scrapeHqProduct } from '../lib/scraper'

const prisma = new PrismaClient()

async function syncOne(product: { id: string; originCode: string; supplierGroupId: string | null }) {
  const group = (product.supplierGroupId ?? '').trim()
  if (!group) return
  try {
    const result = await scrapeHqProduct({
      productCode: product.originCode,
      groupNumber: group,
      baseUrl: process.env.HQ_PRODUCT_BASE_URL,
    })
    const digits = result.latestPrice?.replace(/[^\d]/g, '') ?? ''
    const priceFrom = digits ? parseInt(digits, 10) : undefined
    await prisma.product.update({
      where: { id: product.id },
      data: {
        ...(Number.isFinite(priceFrom) && priceFrom! > 0 ? { priceFrom } : {}),
      },
    })
    console.log(`Updated ${product.originCode}/${group}`, result.scrapedAt, result.bookingStatus, result.departureFixed)
  } catch (err) {
    console.error(`Sync failed ${product.originCode}`, err)
  }
}

async function runSync() {
  const products = await prisma.product.findMany({
    where: {
      originCode: { not: '' },
      supplierGroupId: { not: null },
    },
    select: { id: true, originCode: true, supplierGroupId: true },
  })
  for (const product of products) {
    await syncOne(product)
  }
}

if (require.main === module) {
  runSync()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}

export { runSync }
