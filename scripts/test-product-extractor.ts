/**
 * B-4-1 스모크: `lib/bong-marketing/product-extractor` (DB 읽기).
 *
 *   npx tsx scripts/test-product-extractor.ts [optionalProductId]
 *
 * 필수: DATABASE_URL (`.env.local` 등 — `load-env-for-scripts` 자동)
 */
import './load-env-for-scripts'

import {
  extractProductGeoMeta,
  listProductsForMarketingMonth,
} from '@/lib/bong-marketing/product-extractor'
import { prisma } from '@/lib/prisma'

async function main() {
  const argId = process.argv[2]?.trim()

  const pick =
    argId ||
    (
      await prisma.product.findFirst({
        where: { registrationStatus: 'registered' },
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
      })
    )?.id

  if (!pick) {
    console.error('No registered product in DB and no id argument.')
    process.exit(1)
  }

  console.log('--- extractProductGeoMeta ---')
  console.log('productId:', pick)
  const meta = await extractProductGeoMeta(pick, {
    utmSource: 'naver_blog',
    utmContent: 'final_cta',
  })
  console.log(JSON.stringify(meta, null, 2))
  console.log('inquiryUrl includes utm_source=naver_blog:', meta.inquiryUrl.includes('utm_source=naver_blog'))
  console.log('cta label policy: use literal "상담하기" in UI (meta.ctaProductTitle = snapshot only):', meta.ctaProductTitle)

  const monthKey = '2026-06'
  console.log('\n--- listProductsForMarketingMonth ---', monthKey)
  const list = await listProductsForMarketingMonth(monthKey, { limit: 15 })
  for (const row of list) {
    console.log(`${row.score}\t${row.productId}\t${row.country}\t${row.city ?? '—'}\t${row.reason}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect().catch(() => {})
  process.exit(1)
})
