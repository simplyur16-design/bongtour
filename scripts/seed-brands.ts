/**
 * Brand 테이블 시드. canonical 공급사 + windsor/other.
 *   npx tsx scripts/seed-brands.ts
 */
import './load-env-for-scripts'
import { PrismaClient } from '@prisma/client'
import { brandKeysToEnsure, ensureBrandRow } from '../lib/ensure-product-brand'

const prisma = new PrismaClient()

async function main() {
  for (const key of brandKeysToEnsure()) {
    await ensureBrandRow(prisma, key)
  }
  console.log('Brand seed done:', brandKeysToEnsure().length)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
