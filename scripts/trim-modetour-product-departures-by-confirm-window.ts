/**
 * 등록 확정과 동일한 월 상한(MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD) 밖의 ProductDeparture 삭제.
 *   npx tsx scripts/trim-modetour-product-departures-by-confirm-window.ts [productId]
 */
import { prisma } from '../lib/prisma'
import {
  computeModetourCalendarSearchToYmd,
  MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD,
} from '../lib/scrape-date-bounds'

async function main() {
  const productId = process.argv[2]?.trim() || 'cmnlyq1th000i4doiyo9hanoh'
  const searchTo = computeModetourCalendarSearchToYmd(MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD)
  const cutoff = new Date(`${searchTo}T23:59:59.999Z`)
  const before = await prisma.productDeparture.count({ where: { productId } })
  const del = await prisma.productDeparture.deleteMany({
    where: { productId, departureDate: { gt: cutoff } },
  })
  const after = await prisma.productDeparture.count({ where: { productId } })
  console.log(
    JSON.stringify(
      {
        productId,
        monthsForward: MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD,
        searchToInclusive: searchTo,
        cutoffIso: cutoff.toISOString(),
        beforeCount: before,
        deleted: del.count,
        afterCount: after,
      },
      null,
      2
    )
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
