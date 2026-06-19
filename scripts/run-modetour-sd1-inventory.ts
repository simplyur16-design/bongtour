/**
 * modetour 등록 상품 SD1/SD2 API inventory — parity error 56건 분류.
 *
 *   npm run verify:modetour-sd1-inventory
 *   npm run verify:modetour-sd1-inventory -- --limit 20
 *
 * 결과: ops/modetour-sd1-inventory.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { collectModetourApiDepartureInputs } from '@/lib/modetour-price-collect'
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const OUT_PATH = path.join(process.cwd(), 'ops', 'modetour-sd1-inventory.json')

function readIntArg(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return fallback
  const n = Number.parseInt(process.argv[i + 1] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function sdCodeFromError(msg: string): 'SD1' | 'SD2' | 'other' | null {
  if (msg.includes('[SD2]')) return 'SD2'
  if (msg.includes('[SD1]')) return 'SD1'
  if (/상품이 존재하지 않/.test(msg)) return 'SD1'
  return null
}

async function main() {
  const limit = readIntArg('--limit', 500)
  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const products = await prisma.product.findMany({
    where: { originSource: 'modetour', registrationStatus: 'registered' },
    select: {
      id: true,
      slug: true,
      originUrl: true,
      originCode: true,
      listingKind: true,
      productType: true,
      _count: { select: { departures: true } },
    },
    orderBy: [{ slug: 'asc' }],
    take: limit,
  })

  const items = []
  for (const p of products) {
    const productNo = parseModetourPackageProductNoFromUrl(p.originUrl)
    let status: 'ok' | 'sd1' | 'sd2' | 'error' = 'ok'
    let apiRowCount = 0
    let error: string | null = null
    try {
      const hit = await collectModetourApiDepartureInputs(p.originUrl, fromYmd, toYmd)
      apiRowCount = hit.inputs.length
    } catch (err) {
      error = (err instanceof Error ? err.message : String(err)).slice(0, 500)
      const code = sdCodeFromError(error)
      status = code === 'SD2' ? 'sd2' : code === 'SD1' ? 'sd1' : 'error'
    }
    items.push({
      slug: p.slug,
      id: p.id,
      productNo,
      listingKind: p.listingKind,
      productType: p.productType,
      dbDepartureCount: p._count.departures,
      apiRowCount,
      status,
      error,
    })
  }

  const summary = {
    finishedAt: new Date().toISOString(),
    fromYmd,
    toYmd,
    total: items.length,
    ok: items.filter((i) => i.status === 'ok').length,
    sd1: items.filter((i) => i.status === 'sd1').length,
    sd2: items.filter((i) => i.status === 'sd2').length,
    error: items.filter((i) => i.status === 'error').length,
    sd1WithDbDepartures: items.filter((i) => i.status === 'sd1' && i.dbDepartureCount > 0).length,
    items,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2), 'utf8')
  console.log(JSON.stringify({ ...summary, outFile: OUT_PATH, items: undefined, itemSample: items.slice(0, 5) }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
