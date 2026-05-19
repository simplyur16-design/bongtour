/**
 * 기존 Product.slug 백필 — createdAt ASC, 배치 50.
 * 실행: npx tsx scripts/backfill-product-slug.ts
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'
loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('[backfill-product-slug] DIRECT_URL/DATABASE_URL 둘 다 미로드')
  process.exit(1)
}

import { PrismaClient } from '@prisma/client'
import { ensureProductSlug } from '@/lib/product-slug'

const dbUrl = process.env.DATABASE_URL
const directUrl = process.env.DIRECT_URL
console.log('[diag] DATABASE_URL prefix:', dbUrl?.substring(0, 15))
console.log('[diag] DIRECT_URL prefix:', directUrl?.substring(0, 15))
console.log('[diag] using:', directUrl ? 'DIRECT_URL' : 'DATABASE_URL')

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
})

const BATCH_SIZE = 50

async function main() {
  const total = await prisma.product.count({ where: { slug: null } })
  console.log(`[backfill-product-slug] slug IS NULL: ${total} rows`)

  if (total === 0) {
    console.log('[backfill-product-slug] nothing to do')
    return
  }

  let processed = 0
  let assigned = 0

  while (true) {
    const batch = await prisma.product.findMany({
      where: { slug: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: {
        id: true,
        listingKind: true,
        productType: true,
        originSource: true,
        slug: true,
      },
    })

    if (batch.length === 0) break

    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        const slug = await ensureProductSlug(tx, row.id, {
          listingKind: row.listingKind,
          productType: row.productType,
          originSource: row.originSource,
          slug: row.slug,
        })
        if (slug) assigned += 1
        processed += 1
      }
    })

    const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 100
    console.log(`[backfill-product-slug] progress ${processed}/${total} (${pct}%)`)
  }

  console.log(`[backfill-product-slug] done processed=${processed} assigned=${assigned}`)
}

main()
  .catch((e) => {
    console.error('[backfill-product-slug] fatal', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
