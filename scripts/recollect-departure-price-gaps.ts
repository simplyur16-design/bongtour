/**
 * 가격 갭(registered 해외, RULE_A 창 0건·thin<3) 상품만 공급사별 sweep.
 *
 *   npx tsx scripts/recollect-departure-price-gaps.ts --dry-run
 *   npx tsx scripts/recollect-departure-price-gaps.ts
 *   npx tsx scripts/recollect-departure-price-gaps.ts --zero-only
 *   npx tsx scripts/recollect-departure-price-gaps.ts --source=hanatour
 *
 * windsor 등 sweep 미지원 소스는 skip.
 * 상품 간 대기: PRICE_GAP_RECOLLECT_PAUSE_MS (기본 2000)
 */
import './load-env-for-scripts'

import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { sweepDueHanatourProducts } from '@/lib/hanatour-sweep'
import { sweepDueModetourProducts } from '@/lib/modetour-sweep'
import { sweepDueYbtourProducts } from '@/lib/ybtour-sweep'
import { sweepDueVerygoodtourProducts } from '@/lib/verygoodtour-sweep'
import { sweepDueLottetourProducts } from '@/lib/lottetour-sweep'

const SWEEPABLE = new Set([
  'hanatour',
  'modetour',
  'ybtour',
  'verygoodtour',
  'lottetour',
])

type GapRow = {
  id: string
  slug: string | null
  originSource: string | null
  title: string
  pricedWindow: number
  kind: 'zero' | 'thin'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pauseMs(): number {
  const raw = Number(process.env.PRICE_GAP_RECOLLECT_PAUSE_MS ?? '2000')
  return Number.isFinite(raw) && raw >= 0 ? raw : 2000
}

function readArg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  return process.argv[i + 1]?.trim() || null
}

async function listGaps(prisma: PrismaClient): Promise<GapRow[]> {
  const today = kstTodayYmd()
  const to = addDaysUtcYmd(today, RULE_A_WINDOW_DAYS)
  const fromDate = new Date(`${today}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)

  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      OR: [{ travelScope: null }, { travelScope: { not: 'domestic' } }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      originSource: true,
      _count: {
        select: {
          departures: {
            where: {
              departureDate: { gte: fromDate, lte: toDate },
              adultPrice: { gt: 0 },
            },
          },
        },
      },
    },
    orderBy: [{ originSource: 'asc' }, { slug: 'asc' }],
  })

  const rows: GapRow[] = []
  for (const p of products) {
    const n = p._count.departures
    if (n === 0) {
      rows.push({
        id: p.id,
        slug: p.slug,
        originSource: p.originSource,
        title: (p.title ?? '').slice(0, 80),
        pricedWindow: n,
        kind: 'zero',
      })
    } else if (n < 3) {
      rows.push({
        id: p.id,
        slug: p.slug,
        originSource: p.originSource,
        title: (p.title ?? '').slice(0, 80),
        pricedWindow: n,
        kind: 'thin',
      })
    }
  }
  return rows
}

async function sweepOne(
  prisma: PrismaClient,
  source: string,
  productId: string,
): Promise<unknown> {
  switch (source) {
    case 'hanatour':
      return sweepDueHanatourProducts(prisma, { limit: 1, productId })
    case 'modetour':
      return sweepDueModetourProducts(prisma, { limit: 1, productId })
    case 'ybtour':
      return sweepDueYbtourProducts(prisma, { limit: 1, productId })
    case 'verygoodtour':
      return sweepDueVerygoodtourProducts(prisma, { limit: 1, productId })
    case 'lottetour':
      return sweepDueLottetourProducts(prisma, { limit: 1, productId })
    default:
      return { skipped: true, reason: 'unsupported_source' }
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const zeroOnly = process.argv.includes('--zero-only')
  const sourceFilter = (readArg('--source') ?? '').trim().toLowerCase() || null

  if (!(process.env.HANATOUR_PYTHON_TIMEOUT_MS_PER_MONTH ?? '').trim()) {
    process.env.HANATOUR_PYTHON_TIMEOUT_MS_PER_MONTH = '180000'
  }

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  let gaps = await listGaps(prisma)
  if (zeroOnly) gaps = gaps.filter((g) => g.kind === 'zero')
  if (sourceFilter) gaps = gaps.filter((g) => (g.originSource ?? '') === sourceFilter)

  const skipUnsupported = gaps.filter((g) => !SWEEPABLE.has(g.originSource ?? ''))
  const targets = gaps.filter((g) => SWEEPABLE.has(g.originSource ?? ''))

  console.log(
    `[price-gap-recollect] totalGaps=${gaps.length} targets=${targets.length} skipUnsupported=${skipUnsupported.length} dry=${dryRun} zeroOnly=${zeroOnly}`,
  )
  for (const s of skipUnsupported) {
    console.log(`[skip] ${s.slug} source=${s.originSource} kind=${s.kind}`)
  }

  const log: Array<{
    at: string
    slug: string | null
    source: string | null
    kind: string
    before: number
    result: unknown
  }> = []

  const wait = pauseMs()
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]!
    console.log(
      `[${i + 1}/${targets.length}] ${dryRun ? 'dry' : 'sweep'} ${t.slug} source=${t.originSource} kind=${t.kind} priced=${t.pricedWindow} ${t.title}`,
    )
    if (dryRun) {
      log.push({
        at: new Date().toISOString(),
        slug: t.slug,
        source: t.originSource,
        kind: t.kind,
        before: t.pricedWindow,
        result: { dryRun: true },
      })
      continue
    }

    try {
      const result = await sweepOne(prisma, t.originSource!, t.id)
      console.log(`  → ${JSON.stringify(result)}`)
      log.push({
        at: new Date().toISOString(),
        slug: t.slug,
        source: t.originSource,
        kind: t.kind,
        before: t.pricedWindow,
        result,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  → ERROR ${msg}`)
      log.push({
        at: new Date().toISOString(),
        slug: t.slug,
        source: t.originSource,
        kind: t.kind,
        before: t.pricedWindow,
        result: { error: msg },
      })
    }

    if (i + 1 < targets.length && wait > 0) await sleep(wait)
  }

  const outDir = path.join(process.cwd(), 'scripts', 'data')
  mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `price-gap-recollect-${Date.now()}.json`)
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        dryRun,
        zeroOnly,
        sourceFilter,
        targets: targets.length,
        skipUnsupported: skipUnsupported.map((s) => s.slug),
        log,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log(`[price-gap-recollect] wrote ${outPath}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
