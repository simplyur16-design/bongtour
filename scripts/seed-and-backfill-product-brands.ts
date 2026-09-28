/**
 * Brand 행 시드 + originSource 기준 Product.brandId 백필.
 *   npx tsx scripts/seed-and-backfill-product-brands.ts
 */
import './load-env-for-scripts'
import { PrismaClient } from '@prisma/client'
import {
  brandKeysToEnsure,
  ensureBrandRow,
  resolveBrandKeyForOriginSource,
} from '../lib/ensure-product-brand'

const prisma = new PrismaClient()

async function main() {
  const ensured: Record<string, string> = {}
  for (const key of brandKeysToEnsure()) {
    const row = await ensureBrandRow(prisma, key)
    ensured[key] = row.id
  }
  console.log(JSON.stringify({ brands: Object.keys(ensured).length, keys: Object.keys(ensured) }))

  const products = await prisma.product.findMany({
    where: { brandId: null },
    select: { id: true, originSource: true },
  })
  let linked = 0
  let skipped = 0
  for (const p of products) {
    const key = resolveBrandKeyForOriginSource(p.originSource)
    if (!key || !ensured[key]) {
      skipped++
      continue
    }
    await prisma.product.update({ where: { id: p.id }, data: { brandId: ensured[key] } })
    linked++
  }
  const stillNull = await prisma.product.count({ where: { brandId: null } })
  const brandCount = await prisma.brand.count()
  console.log(JSON.stringify({ linked, skipped, stillNull, brandCount }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
