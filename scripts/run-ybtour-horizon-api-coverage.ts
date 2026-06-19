/**
 * ybtour registered 전체 — 180일 papi by-goods API 커버리지 (E2E·DB upsert 없음).
 *
 *   npm run db:ybtour-api-coverage
 *   npm run db:ybtour-api-coverage -- --limit 20
 *
 * 결과: ops/ybtour-horizon-api-coverage.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import { resolveYbtourGoodsCdForApi } from '@/lib/ybtour-api-departures'
import { collectYbtourApiOnlyForDateRange } from '@/lib/ybtour-price-collect'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const OUT_PATH = path.join(process.cwd(), 'ops', 'ybtour-horizon-api-coverage.json')

type ItemResult = {
  slug: string | null
  id: string
  title: string
  originUrl: string | null
  goodsCd: string | null
  seedEvCd: string | null
  status: 'api_ok' | 'api_empty' | 'api_error' | 'no_goods_cd' | 'no_url'
  rowCount: number
  apiError: string | null
  elapsedMs: number
}

function readArg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  return process.argv[i + 1]?.trim() || null
}

function readIntArg(flag: string, fallback: number): number {
  const v = readArg(flag)
  if (!v) return fallback
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function resolveDetailUrl(originUrl: string | null, originCode: string | null): string | null {
  const stored = (originUrl ?? '').trim()
  if (stored.startsWith('http')) return stored
  const code = (originCode ?? '').trim()
  if (!code) return null
  const built = buildDetailUrl('ybtour', code)
  return built.startsWith('http') ? built : null
}

function withGoodsCdParam(detailUrl: string, originCode: string | null): string {
  const code = (originCode ?? '').trim()
  if (!code || resolveYbtourGoodsCdForApi(detailUrl, originCode)) return detailUrl
  try {
    const u = new URL(detailUrl)
    u.searchParams.set('goodsCd', code)
    if (!u.searchParams.get('menu')?.trim()) u.searchParams.set('menu', 'PKG')
    return u.toString()
  } catch {
    return detailUrl
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function interProductPauseMs(): number {
  const raw = Number(process.env.YBTOUR_COVERAGE_PAUSE_MS ?? '600')
  return Number.isFinite(raw) && raw >= 0 ? raw : 600
}

async function main() {
  const limit = readIntArg('--limit', 99999)
  const fromSlug = readArg('--from-slug')
  const pauseMs = interProductPauseMs()

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const todayYmd = kstTodayYmd()
  const fromYmd = todayYmd
  const toYmd = addDaysUtcYmd(todayYmd, RULE_A_WINDOW_DAYS)

  let products = await prisma.product.findMany({
    where: { registrationStatus: 'registered', originSource: 'ybtour' },
    select: { id: true, slug: true, title: true, originCode: true, originUrl: true },
    orderBy: [{ slug: 'asc' }, { id: 'asc' }],
  })

  if (fromSlug) {
    products = products.filter((p) => p.slug === fromSlug)
  }
  products = products.slice(0, limit)

  const items: ItemResult[] = []
  const startedAt = new Date().toISOString()

  console.log(
    `[ybtour-api-coverage] products=${products.length} horizon=${fromYmd}..${toYmd}`,
  )

  for (let i = 0; i < products.length; i += 1) {
    const p = products[i]!
    const t0 = Date.now()
    let detailUrl = resolveDetailUrl(p.originUrl, p.originCode)

    if (!detailUrl) {
      items.push({
        slug: p.slug,
        id: p.id,
        title: p.title?.slice(0, 80) ?? '',
        originUrl: p.originUrl,
        goodsCd: null,
        seedEvCd: null,
        status: 'no_url',
        rowCount: 0,
        apiError: null,
        elapsedMs: Date.now() - t0,
      })
      continue
    }

    detailUrl = withGoodsCdParam(detailUrl, p.originCode)
    const goodsCdForApi = resolveYbtourGoodsCdForApi(detailUrl, p.originCode)

    if (!goodsCdForApi) {
      items.push({
        slug: p.slug,
        id: p.id,
        title: p.title?.slice(0, 80) ?? '',
        originUrl: detailUrl,
        goodsCd: null,
        seedEvCd: null,
        status: 'no_goods_cd',
        rowCount: 0,
        apiError: null,
        elapsedMs: Date.now() - t0,
      })
      if (i + 1 < products.length && pauseMs > 0) await sleep(pauseMs)
      continue
    }

    const hit = await collectYbtourApiOnlyForDateRange(detailUrl, fromYmd, toYmd, {
      originCode: p.originCode,
      enrichEvCdPrice: false,
    })
    let status: ItemResult['status']
    if (hit.apiError === 'no_goods_cd') status = 'no_goods_cd'
    else if (hit.apiError) status = 'api_error'
    else if (hit.inputs.length > 0) status = 'api_ok'
    else status = 'api_empty'

    items.push({
      slug: p.slug,
      id: p.id,
      title: p.title?.slice(0, 80) ?? '',
      originUrl: detailUrl,
      goodsCd: goodsCdForApi,
      seedEvCd: hit.evCd,
      status,
      rowCount: hit.inputs.length,
      apiError: hit.apiError,
      elapsedMs: Date.now() - t0,
    })

    if ((i + 1) % 10 === 0 || i === products.length - 1) {
      const ok = items.filter((x) => x.status === 'api_ok').length
      const rows = items.reduce((s, x) => s + x.rowCount, 0)
      console.log(`[ybtour-api-coverage] ${i + 1}/${products.length} api_ok=${ok} rows=${rows}`)
    }

    if (i + 1 < products.length && pauseMs > 0) await sleep(pauseMs)
  }

  const summary = {
    total: items.length,
    api_ok: items.filter((x) => x.status === 'api_ok').length,
    api_empty: items.filter((x) => x.status === 'api_empty').length,
    api_error: items.filter((x) => x.status === 'api_error').length,
    no_goods_cd: items.filter((x) => x.status === 'no_goods_cd').length,
    no_url: items.filter((x) => x.status === 'no_url').length,
    api_ok_rate_pct:
      items.length > 0
        ? Math.round((items.filter((x) => x.status === 'api_ok').length / items.length) * 1000) / 10
        : 0,
    total_priced_rows: items.reduce((s, x) => s + x.rowCount, 0),
  }

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    horizonDays: RULE_A_WINDOW_DAYS,
    fromYmd,
    toYmd,
    note: 'papi by-goods month API — full 180-day horizon per goodsCd',
    summary,
    failures: items.filter((x) => x.status !== 'api_ok').slice(0, 50),
    items,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log('[ybtour-api-coverage] summary', summary)
  console.log('[ybtour-api-coverage] wrote', OUT_PATH)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
