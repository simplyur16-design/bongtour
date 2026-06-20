/**
 * verygoodtour — 등록 상품별 HXR vs E2E 필요 여부 교차 검증 (DB upsert 없음).
 *
 *   npm run db:verygoodtour-hxr-e2e-cross-verify
 *   npm run db:verygoodtour-hxr-e2e-cross-verify -- --limit 5
 *
 * 결과: ops/verygoodtour-hxr-e2e-cross-verify.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import {
  collectVerygoodHxrOnlyForDateRange,
  collectVerygoodtourPriceInputsWithE2eFallback,
} from '@/lib/verygoodtour-price-collect'
import { normalizeVerygoodtourDetailUrlForCollect } from '@/lib/verygoodtour-detail-url-health'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const OUT_PATH = path.join(process.cwd(), 'ops', 'verygoodtour-hxr-e2e-cross-verify.json')

function readIntArg(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return fallback
  const n = Number.parseInt(process.argv[i + 1] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function resolveDetailUrl(originUrl: string | null, originCode: string | null): string | null {
  const stored = (originUrl ?? '').trim()
  if (stored.startsWith('http')) return normalizeVerygoodtourDetailUrlForCollect(stored)
  const code = (originCode ?? '').trim()
  if (!code) return null
  const built = buildDetailUrl('verygoodtour', code)
  return built.startsWith('http') ? normalizeVerygoodtourDetailUrlForCollect(built) : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const limit = readIntArg('--limit', 17)
  const skipE2e = process.argv.includes('--hxr-only')
  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const pauseMs = Math.max(0, Number(process.env.VERYGOOD_CROSS_VERIFY_PAUSE_MS ?? '600') || 600)

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const products = await prisma.product.findMany({
    where: { originSource: 'verygoodtour', registrationStatus: 'registered' },
    select: { id: true, slug: true, originUrl: true, originCode: true },
    orderBy: [{ slug: 'asc' }],
    take: limit,
  })

  const items: Array<Record<string, unknown>> = []

  for (const p of products) {
    const url = resolveDetailUrl(p.originUrl, p.originCode)
    if (!url) {
      items.push({ slug: p.slug, status: 'no_url' })
      continue
    }

    const hxr = await collectVerygoodHxrOnlyForDateRange(url, fromYmd, toYmd)
    const hxrOk = hxr.inputs.length > 0
    const needsE2e = !hxrOk && hxr.rightRowCount === 0 && hxr.leftWithPriceCount > 0

    let e2eRowCount: number | null = null
    let e2eAttempted = false
    if (needsE2e && !skipE2e) {
      const full = await collectVerygoodtourPriceInputsWithE2eFallback(url, fromYmd, toYmd)
      e2eAttempted = full.e2eAttempted
      e2eRowCount = full.inputs.length
    }

    items.push({
      slug: p.slug,
      originCode: p.originCode,
      url,
      hxrPricedRows: hxr.inputs.length,
      hxrRightRows: hxr.rightRowCount,
      hxrLeftWithPrice: hxr.leftWithPriceCount,
      needsE2eFallback: needsE2e,
      e2eAttempted,
      e2eRowCount,
      crossMatch:
        hxrOk || (needsE2e && e2eRowCount != null && e2eRowCount > 0) ? 'ok' : needsE2e ? 'e2e_pending' : 'hxr_empty',
    })

    if (pauseMs > 0) await sleep(pauseMs)
  }

  const summary = {
    total: items.length,
    hxrOk: items.filter((x) => (x.hxrPricedRows as number) > 0).length,
    needsE2e: items.filter((x) => x.needsE2eFallback === true).length,
    e2eRecovered: items.filter((x) => (x.e2eRowCount as number) > 0).length,
  }

  const out = { finishedAt: new Date().toISOString(), fromYmd, toYmd, summary, items }
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8')
  console.log(JSON.stringify({ ok: true, outFile: OUT_PATH, summary }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
