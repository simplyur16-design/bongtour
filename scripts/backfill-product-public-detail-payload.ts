/**
 * 등록 완료 상품의 공개 상세 DTO 일괄 생성.
 * Usage: npx tsx scripts/backfill-product-public-detail-payload.ts [--limit N] [--id PRODUCT_ID]
 */
import { prisma } from '../lib/prisma'
import { rebuildProductPublicDetailPayload } from '../lib/product-public-detail/persist-payload'

async function main() {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined
  const idIdx = args.indexOf('--id')
  const singleId = idIdx >= 0 ? args[idIdx + 1] : undefined

  const ids = singleId
    ? [singleId]
    : (
        await prisma.product.findMany({
          where: { registrationStatus: 'registered' },
          select: { id: true },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        })
      ).map((r) => r.id)

  console.log(`[backfill] ${ids.length} products`)
  let ok = 0
  let fail = 0
  for (const id of ids) {
    try {
      const saved = await rebuildProductPublicDetailPayload(id)
      if (saved) ok++
      else console.log(`[skip] ${id} (not registered or missing)`)
    } catch (e) {
      fail++
      console.error(`[fail] ${id}`, e)
    }
  }
  console.log(`[backfill] done ok=${ok} fail=${fail}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
