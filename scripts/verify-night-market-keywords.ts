/**
 * DB 전체 Product.schedule에서 "night market" imageKeyword 검증 (ALLOWED 패턴 확인용).
 */
import './load-env'
import { prisma } from '../lib/prisma'
import { detectBannedSuffix, parseScheduleImageKeywords } from '../lib/image-keyword-verify-guards'

async function main() {
  const products = await prisma.product.findMany({
    where: { schedule: { not: null }, NOT: { schedule: '' } },
    select: { id: true, originCode: true, schedule: true },
  })

  const nightMarket: Array<{
    productId: string
    originCode: string
    day: number
    imageKeyword: string
    banned: string | null
  }> = []

  for (const p of products) {
    for (const row of parseScheduleImageKeywords(p.schedule)) {
      if (/night\s+market/i.test(row.imageKeyword)) {
        nightMarket.push({
          productId: p.id,
          originCode: p.originCode,
          day: row.day,
          imageKeyword: row.imageKeyword,
          banned: detectBannedSuffix(row.imageKeyword),
        })
      }
    }
  }

  console.log('=== Night Market imageKeyword (full DB scan) ===\n')
  console.log(`Found: ${nightMarket.length} row(s)\n`)

  for (const r of nightMarket) {
    const status = r.banned ? `FAIL [${r.banned}]` : 'OK'
    console.log(`  ${status}  ${r.productId}  day ${r.day}  ${JSON.stringify(r.imageKeyword)}`)
  }

  const fails = nightMarket.filter((r) => r.banned)
  console.log(`\n--- summary ---`)
  console.log(`pass: ${nightMarket.length - fails.length}  fail: ${fails.length}`)

  if (fails.length > 0) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
