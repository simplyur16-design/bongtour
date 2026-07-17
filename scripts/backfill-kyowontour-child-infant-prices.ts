/**
 * 교원이지 등록 상품 — goodsEventDetail hidden 아동·유아 + 캘린더 성인 재수집·upsert.
 *
 *   npx tsx scripts/backfill-kyowontour-child-infant-prices.ts --dry-run
 *   npx tsx scripts/backfill-kyowontour-child-infant-prices.ts
 *   npx tsx scripts/backfill-kyowontour-child-infant-prices.ts --limit=20
 */
import './load-env-for-scripts'

import { PrismaClient } from '@prisma/client'
import { collectKyowontourPriceInputsWithE2eFallback } from '@/lib/kyowontour-price-collect'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import {
  enrichKyowontourDepartureInputsForConfirmSave,
  upsertProductDepartures,
} from '@/lib/upsert-product-departures-kyowontour'
import { parseKyowontourThreeSlotPricesFromDetailHtml } from '@/lib/kyowontour-tourcode-detail-meta'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readFlag(name: string): boolean {
  return process.argv.includes(name)
}

function readArg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  return process.argv[i + 1]?.trim() || null
}

async function fetchDetailSlots(originUrl: string): Promise<{
  adultPrice: number | null
  childPrice: number | null
  infantPrice: number | null
}> {
  try {
    const res = await fetch(originUrl, {
      headers: {
        accept: 'text/html',
        'user-agent': 'Mozilla/5.0 (compatible; BongTour/1.0)',
      },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return { adultPrice: null, childPrice: null, infantPrice: null }
    return parseKyowontourThreeSlotPricesFromDetailHtml(await res.text())
  } catch {
    return { adultPrice: null, childPrice: null, infantPrice: null }
  }
}

async function main() {
  const dryRun = readFlag('--dry-run')
  const limit = Math.max(1, Number(readArg('--limit') ?? '500') || 500)
  const pauseMs = Math.max(0, Number(process.env.KYOWONTOUR_CHILD_BACKFILL_PAUSE_MS ?? '1200') || 1200)
  const prisma = new PrismaClient()
  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)

  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      OR: [{ originSource: 'kyowontour' }, { originUrl: { contains: 'kyowontour.com' } }],
    },
    select: { id: true, slug: true, title: true, originUrl: true, originCode: true },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  })

  console.log(
    `[kyo-child-backfill] products=${products.length} dry=${dryRun} window=${fromYmd}..${toYmd}`,
  )

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const p of products) {
    const url = (p.originUrl ?? '').trim()
    if (!url || !/kyowontour\.com/i.test(url)) {
      skipped++
      continue
    }
    try {
      const slots = await fetchDetailSlots(url)
      const collected = await collectKyowontourPriceInputsWithE2eFallback(
        { id: p.id, originCode: p.originCode, originUrl: url },
        fromYmd,
        toYmd,
      )
      let inputs = collected.inputs
      if (inputs.length === 0) {
        console.log(`[skip] ${p.id} ${p.slug ?? ''} inputs=0`)
        skipped++
        await sleep(pauseMs)
        continue
      }
      const child = slots.childPrice
      const infant = slots.infantPrice
      inputs = inputs.map((row) => ({
        ...row,
        childBedPrice: child ?? row.childBedPrice ?? null,
        infantPrice: infant ?? row.infantPrice ?? null,
      }))
      inputs = enrichKyowontourDepartureInputsForConfirmSave(inputs, infant)

      const sample = inputs[0]
      console.log(
        `[${dryRun ? 'dry' : 'upsert'}] ${p.id} ${String(p.title ?? '').slice(0, 40)} n=${inputs.length} adult=${sample?.adultPrice} child=${sample?.childBedPrice} infant=${sample?.infantPrice}`,
      )

      if (!dryRun) {
        await upsertProductDepartures(prisma, p.id, inputs)
        if (child != null || infant != null) {
          await prisma.productPrice.updateMany({
            where: { productId: p.id },
            data: {
              ...(child != null && child > 0 ? { childBed: child } : {}),
              ...(infant != null && infant > 0 ? { infant } : {}),
            },
          })
        }
      }
      updated++
    } catch (e) {
      failed++
      console.error(`[fail] ${p.id}`, e instanceof Error ? e.message : e)
    }
    await sleep(pauseMs)
  }

  console.log(`[kyo-child-backfill] done updated=${updated} skipped=${skipped} failed=${failed}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  process.exit(1)
})
