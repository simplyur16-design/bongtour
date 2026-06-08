/**
 * 운영 일괄 처리 (2026-06):
 * - auto_unpublished 전량 registered 복구 (SD1 modetour 포함)
 * - rejected: 순례길 트레킹·런던 자유여행 재공개 (런던 중복 시 스킵)
 * - rejected: 국내여행(pkg-mt-0001) DB 삭제
 *
 * npx tsx scripts/ops-republish-unpublished-batch.ts
 * npx tsx scripts/ops-republish-unpublished-batch.ts --apply
 */
import './load-env-for-scripts'
import { PrismaClient } from '@prisma/client'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'

const DOMESTIC_DELETE_SLUG = 'pkg-mt-0001'
const REPUBLISH_REJECTED_SLUGS = ['pkg-hn-0011', 'fit-hn-0010'] as const

async function findLondonDuplicate(
  prisma: PrismaClient,
  product: { id: string; originSource: string; originCode: string | null; originUrl: string | null },
) {
  const clauses = []
  if (product.originCode?.trim()) {
    clauses.push({
      id: { not: product.id },
      registrationStatus: 'registered',
      originSource: product.originSource,
      originCode: product.originCode.trim(),
    })
  }
  if (product.originUrl?.trim()) {
    clauses.push({
      id: { not: product.id },
      registrationStatus: 'registered',
      originUrl: product.originUrl.trim(),
    })
  }
  if (clauses.length === 0) return null
  return prisma.product.findFirst({
    where: { OR: clauses },
    select: { id: true, slug: true, title: true },
  })
}

async function main() {
  const apply = process.argv.includes('--apply')
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const autoUnpub = await prisma.product.findMany({
    where: { registrationStatus: 'auto_unpublished' },
    select: { id: true, slug: true, originSource: true, listingKind: true, title: true },
    orderBy: { updatedAt: 'desc' },
  })

  const domestic = await prisma.product.findFirst({
    where: { slug: DOMESTIC_DELETE_SLUG },
    select: { id: true, slug: true, title: true, registrationStatus: true },
  })

  const rejectedTargets = await prisma.product.findMany({
    where: { slug: { in: [...REPUBLISH_REJECTED_SLUGS] } },
    select: {
      id: true,
      slug: true,
      title: true,
      registrationStatus: true,
      originSource: true,
      originCode: true,
      originUrl: true,
    },
  })

  const london = rejectedTargets.find((p) => p.slug === 'fit-hn-0010')
  const londonDup = london ? await findLondonDuplicate(prisma, london) : null

  const plan = {
    mode: apply ? 'apply' : 'dry-run',
    republishAutoUnpublished: autoUnpub.length,
    deleteDomestic: domestic
      ? { slug: domestic.slug, title: domestic.title, status: domestic.registrationStatus }
      : null,
    republishRejected: rejectedTargets.map((p) => ({
      slug: p.slug,
      status: p.registrationStatus,
      skip: p.slug === 'fit-hn-0010' && londonDup != null,
      londonDuplicateOf: p.slug === 'fit-hn-0010' && londonDup ? londonDup.slug ?? londonDup.id : null,
    })),
  }

  console.log(JSON.stringify(plan, null, 2))

  if (!apply) {
    console.log('\n[dry-run] --apply 로 실제 반영')
    await prisma.$disconnect()
    return
  }

  const republishIds = [...autoUnpub.map((p) => p.id)]
  for (const p of rejectedTargets) {
    if (p.slug === 'fit-hn-0010' && londonDup) continue
    republishIds.push(p.id)
  }

  if (republishIds.length > 0) {
    const updated = await prisma.product.updateMany({
      where: { id: { in: republishIds } },
      data: {
        registrationStatus: 'registered',
        autoUnpublishedAt: null,
        autoUnpublishedReason: null,
        rejectReason: null,
        rejectedAt: null,
      },
    })
    console.log(`[apply] registered 복구: ${updated.count}건`)
  }

  if (domestic) {
    const booked = await prisma.booking.count({ where: { productId: domestic.id } })
    if (booked > 0) {
      throw new Error(`국내 상품 ${domestic.slug} — 예약 ${booked}건 연결로 삭제 불가`)
    }
    await prisma.$transaction(async (tx) => {
      await tx.scraperQueue.deleteMany({ where: { productId: domestic.id } })
      await tx.agentScrapeReport.updateMany({
        where: { productId: domestic.id },
        data: { productId: null },
      })
      await tx.product.delete({ where: { id: domestic.id } })
    })
    console.log(`[apply] 국내 상품 삭제: ${domestic.slug}`)
  }

  try {
    revalidateProductListingCaches()
  } catch {
    /* non-Next context */
  }

  await prisma.$disconnect()
  console.log('[apply] 완료')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
