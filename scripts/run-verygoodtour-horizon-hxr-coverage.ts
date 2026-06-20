/**
 * verygoodtour — 180일 ProductCalendarSearch HXR 커버리지 (E2E·DB upsert 없음).
 *
 * SSOT probe: ops/verygoodtour-horizon-hxr-probe.json
 *
 *   npm run db:verygoodtour-hxr-coverage
 *   npm run db:verygoodtour-hxr-coverage -- --db --limit 20
 *
 * 결과: ops/verygoodtour-horizon-hxr-coverage.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import { collectVerygoodHxrOnlyForDateRange } from '@/lib/verygoodtour-price-collect'
import { normalizeVerygoodtourDetailUrlForCollect } from '@/lib/verygoodtour-detail-url-health'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const PROBE_PATH = path.join(process.cwd(), 'ops', 'verygoodtour-horizon-hxr-probe.json')
const OUT_PATH = path.join(process.cwd(), 'ops', 'verygoodtour-horizon-hxr-coverage.json')

type ProbeEntry = { label: string; url: string }

type ItemResult = {
  label: string
  slug: string | null
  url: string
  status: 'hxr_ok' | 'hxr_left_only' | 'hxr_empty' | 'hxr_error' | 'no_url'
  pricedRowCount: number
  rightRowCount: number
  leftWithPriceCount: number
  hxrError: string | null
  warnings: string[]
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

function loadProbes(): ProbeEntry[] {
  if (!fs.existsSync(PROBE_PATH)) return []
  const raw = JSON.parse(fs.readFileSync(PROBE_PATH, 'utf8')) as { probes?: ProbeEntry[] }
  return Array.isArray(raw.probes) ? raw.probes : []
}

function resolveDetailUrl(originUrl: string | null, originCode: string | null): string | null {
  const stored = (originUrl ?? '').trim()
  if (stored.startsWith('http')) return stored
  const code = (originCode ?? '').trim()
  if (!code) return null
  const built = buildDetailUrl('verygoodtour', code)
  return built.startsWith('http') ? built : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function interPauseMs(): number {
  const raw = Number(process.env.VERYGOOD_HXR_COVERAGE_PAUSE_MS ?? '800')
  return Number.isFinite(raw) && raw >= 0 ? raw : 800
}

async function probeOne(
  label: string,
  url: string,
  slug: string | null,
  fromYmd: string,
  toYmd: string,
): Promise<ItemResult> {
  const t0 = Date.now()
  const normalized = normalizeVerygoodtourDetailUrlForCollect(url)
  try {
    const hxr = await collectVerygoodHxrOnlyForDateRange(normalized, fromYmd, toYmd)
    const status: ItemResult['status'] =
      hxr.inputs.length > 0
        ? 'hxr_ok'
        : hxr.rightRowCount === 0 && hxr.leftWithPriceCount > 0
          ? 'hxr_left_only'
          : hxr.hxrError
            ? 'hxr_error'
            : 'hxr_empty'
    return {
      label,
      slug,
      url: normalized,
      status,
      pricedRowCount: hxr.inputs.length,
      rightRowCount: hxr.rightRowCount,
      leftWithPriceCount: hxr.leftWithPriceCount,
      hxrError: hxr.hxrError,
      warnings: hxr.warnings.slice(0, 8),
      elapsedMs: Date.now() - t0,
    }
  } catch (err) {
    return {
      label,
      slug,
      url: normalized,
      status: 'hxr_error',
      pricedRowCount: 0,
      rightRowCount: 0,
      leftWithPriceCount: 0,
      hxrError: (err instanceof Error ? err.message : String(err)).slice(0, 200),
      warnings: [],
      elapsedMs: Date.now() - t0,
    }
  }
}

async function main() {
  const useDb = process.argv.includes('--db')
  const limit = readIntArg('--limit', 99999)
  const fromSlug = readArg('--from-slug')
  const pauseMs = interPauseMs()

  const todayYmd = kstTodayYmd()
  const fromYmd = todayYmd
  const toYmd = addDaysUtcYmd(todayYmd, RULE_A_WINDOW_DAYS)

  const targets: { label: string; url: string; slug: string | null }[] = loadProbes().map((p) => ({
    label: p.label,
    url: p.url,
    slug: null,
  }))

  if (useDb) {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.error('DATABASE_URL required for --db')
      process.exit(1)
    }
    const prisma = new PrismaClient({
      datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
    })
    let products = await prisma.product.findMany({
      where: { registrationStatus: 'registered', originSource: 'verygoodtour' },
      select: { slug: true, originUrl: true, originCode: true },
      orderBy: [{ slug: 'asc' }],
    })
    if (fromSlug) products = products.filter((p) => p.slug === fromSlug)
    for (const p of products.slice(0, limit)) {
      const url = resolveDetailUrl(p.originUrl, p.originCode)
      if (!url) continue
      targets.push({ label: `db:${p.slug}`, url, slug: p.slug })
    }
    await prisma.$disconnect()
  }

  console.error(
    `[verygood-hxr-coverage] targets=${targets.length} window=${fromYmd}..${toYmd} pauseMs=${pauseMs}`,
  )

  const results: ItemResult[] = []
  for (let i = 0; i < targets.length; i += 1) {
    const t = targets[i]!
    const r = await probeOne(t.label, t.url, t.slug, fromYmd, toYmd)
    results.push(r)
    console.error(
      `[${i + 1}/${targets.length}] ${r.label} status=${r.status} priced=${r.pricedRowCount} right=${r.rightRowCount} leftPrice=${r.leftWithPriceCount}`,
    )
    if (i + 1 < targets.length && pauseMs > 0) await sleep(pauseMs)
  }

  const summary = {
    total: results.length,
    hxr_ok: results.filter((x) => x.status === 'hxr_ok').length,
    hxr_left_only: results.filter((x) => x.status === 'hxr_left_only').length,
    hxr_empty: results.filter((x) => x.status === 'hxr_empty').length,
    hxr_error: results.filter((x) => x.status === 'hxr_error').length,
  }

  const report = {
    finishedAt: new Date().toISOString(),
    fromYmd,
    toYmd,
    horizonDays: RULE_A_WINDOW_DAYS,
    summary,
    results,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify({ ok: true, outFile: OUT_PATH, summary }, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
