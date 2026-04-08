/**
 * 테스트·샘플 성격 Product 정리.
 *
 * 1) 조회·분류 (기본)
 *    npx tsx scripts/purge-test-products.ts
 *
 * 2) 표식 기반 삭제 (상품명/코드/출처에 테스트 키워드)
 *    npx tsx scripts/purge-test-products.ts --apply --mode markers
 *
 * 2b) 위 중 해외 패키지·자유형 제목만 (국내 테스트 제외)
 *    npx tsx scripts/purge-test-products.ts --apply --mode markers --overseas-only
 *
 * 3) 비등록 전체 삭제 (로컬 초기화용 — 위험)
 *    npx tsx scripts/purge-test-products.ts --apply --mode non-registered --confirm-non-registered
 *
 * @see lib/overseas-test-product-policy.ts
 */
import { PrismaClient } from '@prisma/client'
import {
  classifyTestProduct,
  TEST_PRODUCT_POLICY_SUMMARY,
  type TestProductClassification,
} from '../lib/overseas-test-product-policy'
import { triageProductTitleForPickTab } from '../lib/gallery-product-triage'

const prisma = new PrismaClient()

function parseArgs() {
  const argv = process.argv.slice(2)
  let mode: 'markers' | 'non-registered' = 'markers'
  const mi = argv.indexOf('--mode')
  if (mi >= 0) {
    const v = argv[mi + 1]
    if (v === 'markers' || v === 'non-registered') mode = v
  }
  return {
    apply: argv.includes('--apply'),
    mode,
    confirmNonReg: argv.includes('--confirm-non-registered'),
    /** 표식 매칭 중 해외 패키지·자유형(국내 제외)만 삭제 */
    overseasOnly: argv.includes('--overseas-only'),
  }
}

function selectPurgeIds(
  rows: TestProductClassification[],
  mode: 'markers' | 'non-registered',
  overseasOnly: boolean
): string[] {
  if (mode === 'markers') {
    let hit = rows.filter((r) => r.purgeByMarkers)
    if (overseasOnly) hit = hit.filter((r) => isOverseasTriageTitle(r.title))
    return hit.map((r) => r.id)
  }
  return rows.filter((r) => r.isNonRegistered).map((r) => r.id)
}

function isOverseasTriageTitle(title: string): boolean {
  const t = triageProductTitleForPickTab(title)
  return t === 'overseas_package' || t === 'freeform'
}

async function main() {
  const { apply, mode, confirmNonReg, overseasOnly } = parseArgs()

  console.log('=== 테스트 상품 삭제 정책 ===\n')
  console.log(TEST_PRODUCT_POLICY_SUMMARY)
  console.log('\n')

  if (mode === 'non-registered' && apply && !confirmNonReg) {
    console.error('거절: non-registered 모드 삭제에는 --confirm-non-registered 가 필요합니다.')
    process.exit(1)
  }

  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      originCode: true,
      originSource: true,
      registrationStatus: true,
    },
  })

  const classified = products.map((p) => classifyTestProduct(p))

  let markerHits = classified.filter((c) => c.purgeByMarkers)
  if (overseasOnly) {
    markerHits = markerHits.filter((c) => isOverseasTriageTitle(c.title))
  }
  const nonReg = classified.filter((c) => c.isNonRegistered)

  console.log(`전체 Product: ${classified.length}건`)
  if (overseasOnly) {
    console.log('(--overseas-only) 해외 패키지·자유형 제목 분류만 표식 삭제 대상에 포함')
  }
  console.log(`표식 매칭(삭제 후보·markers 모드): ${markerHits.length}건`)
  console.log(`registered 아님: ${nonReg.length}건`)
  console.log('')

  if (markerHits.length > 0) {
    console.log('--- 표식 매칭 목록 ---')
    for (const c of markerHits) {
      console.log(`- ${c.id} | ${c.originSource} / ${c.originCode} | ${c.title.slice(0, 60)}…`)
      console.log(`  rules: ${c.matchedRules.join(', ')}`)
    }
    console.log('')
  }

  const candidateIds = selectPurgeIds(classified, mode, overseasOnly)
  if (candidateIds.length === 0) {
    console.log('삭제 대상 없음. 종료.')
    await prisma.$disconnect()
    return
  }

  const booked = new Set(
    (await prisma.booking.findMany({ select: { productId: true } })).map((b) => b.productId)
  )
  const safeIds = candidateIds.filter((id) => !booked.has(id))
  const skippedBooked = candidateIds.filter((id) => booked.has(id))

  if (skippedBooked.length > 0) {
    console.log(`예약 연결로 삭제 스킵: ${skippedBooked.length}건`)
    for (const id of skippedBooked) console.log(`  - ${id}`)
    console.log('')
  }

  console.log(`최종 삭제 대상: ${safeIds.length}건 (mode=${mode})`)

  if (!apply) {
    console.log('\n(드라이런) --apply 를 붙이면 실제 삭제합니다.')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.scraperQueue.deleteMany({ where: { productId: { in: safeIds } } })
    await tx.agentScrapeReport.updateMany({
      where: { productId: { in: safeIds } },
      data: { productId: null },
    })
    const del = await tx.product.deleteMany({ where: { id: { in: safeIds } } })
    console.log(`\n삭제 완료: ${del.count}건`)
  })

  const remaining = await prisma.product.count()
  console.log(`남은 Product: ${remaining}건`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
