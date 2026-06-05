/**
 * DB에서 title 직접 수정 후 publicDetailPayloadJson 재빌드.
 *
 * npx tsx scripts/refresh-product-titles-from-db.ts
 * npx tsx scripts/refresh-product-titles-from-db.ts --slug pkg-mt-0054
 * npx tsx scripts/refresh-product-titles-from-db.ts --id clxxx
 */
import dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: '.env.local', override: true })

async function main() {
  const args = process.argv.slice(2)
  const idIdx = args.indexOf('--id')
  const slugIdx = args.indexOf('--slug')
  const limitIdx = args.indexOf('--limit')

  const productIds = idIdx >= 0 ? [args[idIdx + 1]!].filter(Boolean) : undefined
  const slugs = slugIdx >= 0 ? [args[slugIdx + 1]!].filter(Boolean) : undefined
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined

  const { refreshProductTitlesFromDb } = await import('../lib/refresh-product-titles-from-db')
  const result = await refreshProductTitlesFromDb({ productIds, slugs, limit })

  console.log('[refresh-product-titles]', {
    requested: result.requested,
    rebuilt: result.rebuilt,
    skipped: result.skipped,
    failed: result.failed,
  })
  if (result.failedIds.length) {
    console.error('[refresh-product-titles] failedIds', result.failedIds)
  }
  for (const p of result.products.slice(0, 20)) {
    console.log(`  ${p.slug ?? p.id}  ${p.title.slice(0, 72)}`)
  }
  if (result.products.length > 20) {
    console.log(`  ... +${result.products.length - 20} more`)
  }

  const { prisma } = await import('../lib/prisma')
  await prisma.$disconnect()

  if (result.failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
