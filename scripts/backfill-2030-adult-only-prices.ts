/**
 * 이미 등록된 2030(성인 전용) 상품 — ProductDeparture·ProductPrice 아동·유아 슬롯 비우기.
 *
 *   npx tsx scripts/backfill-2030-adult-only-prices.ts --dry-run
 *   npx tsx scripts/backfill-2030-adult-only-prices.ts
 *   npx tsx scripts/backfill-2030-adult-only-prices.ts --limit=50
 *
 * REGRESSION-FREEZE[product-adult-only-2030]: backfill null child/infant — manifest
 */
import './load-env-for-scripts'

import { PrismaClient } from '@prisma/client'
import {
  isProductAdultOnly2030,
  productHas2030SportsThemeTag,
} from '@/lib/product-adult-only-2030'

function readFlag(name: string): boolean {
  return process.argv.includes(name)
}

function readArg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  return process.argv[i + 1]?.trim() || null
}

async function main() {
  const dryRun = readFlag('--dry-run')
  const limit = Math.max(1, Number(readArg('--limit') ?? '2000') || 2000)
  const prisma = new PrismaClient()

  const candidates = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      OR: [
        { sportsThemeTag: { has: '2030' } },
        { title: { contains: '2030' } },
        { title: { contains: '밍글링' } },
        { title: { contains: '투어 Light' } },
        { title: { contains: '또래 친구' } },
        { rawTitle: { contains: '2030' } },
        { rawTitle: { contains: '밍글링' } },
        { originalTitle: { contains: '2030' } },
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      rawTitle: true,
      originalTitle: true,
      sportsThemeTag: true,
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  })

  const products = candidates.filter((p) =>
    isProductAdultOnly2030({
      title: p.title,
      rawTitle: p.rawTitle ?? p.originalTitle,
      sportsThemeTag: p.sportsThemeTag,
    }),
  )

  console.log(
    `[2030-adult-only-backfill] candidates=${candidates.length} matched=${products.length} dry=${dryRun}`,
  )

  let updated = 0

  for (const p of products) {
    const depDirty = await prisma.productDeparture.count({
      where: {
        productId: p.id,
        OR: [
          { childBedPrice: { not: null } },
          { childNoBedPrice: { not: null } },
          { infantPrice: { not: null } },
        ],
      },
    })
    const priceDirty = await prisma.productPrice.count({
      where: {
        productId: p.id,
        OR: [{ childBed: { gt: 0 } }, { childNoBed: { gt: 0 } }, { infant: { gt: 0 } }],
      },
    })
    const needsTag = !productHas2030SportsThemeTag(p.sportsThemeTag)

    console.log(
      `[2030-adult-only-backfill] ${p.slug ?? p.id} depDirty=${depDirty} priceDirty=${priceDirty} tag=${needsTag ? 'add' : 'ok'}`,
    )

    if (dryRun) {
      updated += 1
      continue
    }

    await prisma.$transaction(async (tx) => {
      if (depDirty > 0) {
        await tx.productDeparture.updateMany({
          where: { productId: p.id },
          data: {
            childBedPrice: null,
            childNoBedPrice: null,
            infantPrice: null,
          },
        })
      }
      if (priceDirty > 0) {
        await tx.productPrice.updateMany({
          where: { productId: p.id },
          data: { childBed: 0, childNoBed: 0, infant: 0 },
        })
      }
      await tx.product.update({
        where: { id: p.id },
        data: {
          ...(needsTag
            ? { sportsThemeTag: Array.from(new Set([...(p.sportsThemeTag ?? []), '2030'])) }
            : {}),
          /** 공개 상세 캐시 재빌드 — 아동·유아 스트립·성인 전용 플래그 반영 */
          publicDetailPayloadJson: null,
          publicDetailPayloadBuiltAt: null,
        },
      })
    })
    updated += 1
  }

  console.log(`[2030-adult-only-backfill] done updated=${updated}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  process.exitCode = 1
})
