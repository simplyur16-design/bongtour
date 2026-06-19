/**
 * hanatour registered 전체 — 180일 gw API 커버리지 측정 (E2E 없음, DB upsert 없음).
 *
 *   npm run db:hanatour-api-coverage
 *   npm run db:hanatour-api-coverage -- --limit 20
 *   npm run db:hanatour-api-coverage -- --from-slug pkg-ht-0001
 *
 * 결과: ops/hanatour-horizon-api-coverage.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import {
  buildHanatourKstTargetMonths,
  validateHanatourAdminMonthYm,
} from '@/lib/hanatour-departures'
import { collectHanatourApiOnlyForDateRange } from '@/lib/hanatour-price-collect'
import { parseHanatourPkgCdFromUrl } from '@/lib/hanatour-api-departures'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { resolveHanatourAdminE2eMonthsForward } from '@/lib/scrape-date-bounds'

const OUT_PATH = path.join(process.cwd(), 'ops', 'hanatour-horizon-api-coverage.json')

type ProductRow = {
  id: string
  slug: string | null
  title: string
  originCode: string | null
  originUrl: string | null
}

type ItemResult = {
  slug: string | null
  id: string
  title: string
  originUrl: string | null
  pkgCd: string | null
  status: 'api_ok' | 'api_empty' | 'api_error' | 'no_url' | 'no_pkg_cd'
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

function monthYmsForHorizon(fromYmd: string, toYmd: string): string[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const horizon = resolveHanatourAdminE2eMonthsForward()
  const allowedYm = new Set(buildHanatourKstTargetMonths(horizon))
  const ymSet = new Set<string>()
  let cur = lo
  for (let guard = 0; guard < 400 && cur <= hi; guard += 1) {
    const ym = cur.slice(0, 7)
    const validated = validateHanatourAdminMonthYm(ym)
    if (validated && allowedYm.has(validated)) ymSet.add(validated)
    const [y, m, d] = cur.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + 1)
    cur = dt.toISOString().slice(0, 10)
  }
  return [...ymSet].sort()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function interProductPauseMs(): number {
  const raw = Number(process.env.HANATOUR_COVERAGE_PAUSE_MS ?? '800')
  return Number.isFinite(raw) && raw >= 0 ? raw : 800
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
  const monthYms = monthYmsForHorizon(fromYmd, toYmd)

  let products = await prisma.product.findMany({
    where: { registrationStatus: 'registered', originSource: 'hanatour' },
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
    `[hanatour-api-coverage] products=${products.length} horizon=${fromYmd}..${toYmd} months=${monthYms.length}`,
  )

  for (let i = 0; i < products.length; i += 1) {
    const p = products[i]!
    const t0 = Date.now()
    const detailUrl =
      (p.originUrl ?? '').trim().startsWith('http')
        ? p.originUrl!.trim()
        : buildDetailUrl('hanatour', p.originCode ?? '')

    if (!detailUrl.startsWith('http')) {
      items.push({
        slug: p.slug,
        id: p.id,
        title: p.title?.slice(0, 80) ?? '',
        originUrl: p.originUrl,
        pkgCd: null,
        status: 'no_url',
        rowCount: 0,
        apiError: null,
        elapsedMs: Date.now() - t0,
      })
      continue
    }

    const hit = await collectHanatourApiOnlyForDateRange(detailUrl, fromYmd, toYmd, monthYms)
    const pkgCd = hit.pkgCd ?? parseHanatourPkgCdFromUrl(detailUrl)
    let status: ItemResult['status']
    if (!pkgCd) status = 'no_pkg_cd'
    else if (hit.apiError) status = 'api_error'
    else if (hit.inputs.length > 0) status = 'api_ok'
    else status = 'api_empty'

    items.push({
      slug: p.slug,
      id: p.id,
      title: p.title?.slice(0, 80) ?? '',
      originUrl: detailUrl,
      pkgCd,
      status,
      rowCount: hit.inputs.length,
      apiError: hit.apiError,
      elapsedMs: Date.now() - t0,
    })

    if ((i + 1) % 10 === 0 || i === products.length - 1) {
      const ok = items.filter((x) => x.status === 'api_ok').length
      console.log(`[hanatour-api-coverage] ${i + 1}/${products.length} api_ok=${ok}`)
    }

    if (i + 1 < products.length && pauseMs > 0) await sleep(pauseMs)
  }

  const summary = {
    total: items.length,
    api_ok: items.filter((x) => x.status === 'api_ok').length,
    api_empty: items.filter((x) => x.status === 'api_empty').length,
    api_error: items.filter((x) => x.status === 'api_error').length,
    no_pkg_cd: items.filter((x) => x.status === 'no_pkg_cd').length,
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
    monthYms,
    summary,
    failures: items.filter((x) => x.status !== 'api_ok').slice(0, 50),
    items,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log('[hanatour-api-coverage] summary', summary)
  console.log('[hanatour-api-coverage] wrote', OUT_PATH)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
