/**
 * 향후 6개월(180일) 성인가 없음 + E2E/스크래퍼 검증 마커 있는 상품 DB 삭제.
 *
 *   npx tsx scripts/purge-products-no-six-month-price.ts
 *   npx tsx scripts/purge-products-no-six-month-price.ts --apply
 *   npx tsx scripts/purge-products-no-six-month-price.ts --apply --limit=50
 *
 * 마커 SSOT: `lib/product-six-month-price-verification.ts`
 *   - rawMeta.calendarBatchRetired (달력 E2E sequential 지평선 완료)
 *   - Product.noFutureDepartureConfirmedAt (라이브 180일 fetch·modetour sweep)
 */
import { PrismaClient } from '@prisma/client'
import {
  findSixMonthNoPricePurgeCandidates,
  purgeSixMonthNoPriceProduct,
} from '@/lib/product-six-month-price-purge'

const prisma = new PrismaClient()

function parseArgs() {
  const argv = process.argv.slice(2)
  const limitIdx = argv.findIndex((a) => a.startsWith('--limit='))
  const limitRaw = limitIdx >= 0 ? Number(argv[limitIdx]!.split('=')[1]) : 100
  return {
    apply: argv.includes('--apply'),
    limit: Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 100,
  }
}

async function main() {
  const { apply, limit } = parseArgs()
  const candidates = await findSixMonthNoPricePurgeCandidates(prisma, { limit })

  console.log('=== 6개월 미래 가격 없음 · 검증 마커 있는 상품 삭제 ===\n')
  console.log(`후보 ${candidates.length}건 (limit=${limit}, mode=${apply ? 'apply' : 'dry-run'})\n`)

  if (candidates.length === 0) {
    await prisma.$disconnect()
    return
  }

  for (const c of candidates) {
    console.log(
      `- ${c.id} | ${c.originSource ?? '—'} | ${c.title.slice(0, 48)} | markers=${c.markerSources.join(',')} | horizon<=${c.horizonYmd}`,
    )
  }

  if (!apply) {
    console.log('\n[dry-run] 삭제하려면 --apply 를 붙이세요.')
    await prisma.$disconnect()
    return
  }

  let deleted = 0
  let skippedBookings = 0
  for (const c of candidates) {
    const r = await purgeSixMonthNoPriceProduct(prisma, c.id)
    if (r.status === 'deleted') deleted += 1
    else if (r.status === 'skipped_bookings') {
      skippedBookings += 1
      console.warn(`[skip] ${c.id} — 예약 ${r.bookingCount}건`)
    }
  }

  console.log(`\n[apply] deleted=${deleted} skipped_bookings=${skippedBookings}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
