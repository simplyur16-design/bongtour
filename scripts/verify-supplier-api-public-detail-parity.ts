/**
 * 공급사 API sweep → ProductDeparture → 공개 상세 price-row 3계층 정합 검증.
 *
 * 계약: docs/ops/supplier-api-public-detail-parity-contract.md
 *
 *   npm run verify:supplier-api-public-detail-parity
 *   npm run verify:supplier-api-public-detail-parity -- --supplier ybtour --limit 5
 *   npm run verify:supplier-api-public-detail-parity -- --slug pkg-yb-0001
 *   npm run verify:supplier-api-public-detail-parity -- --skip-live-api
 *
 * 결과: ops/supplier-api-public-detail-parity.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import type { ProductDeparture } from '@prisma/client'
import { PrismaClient } from '@prisma/client'

import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import { collectHanatourApiOnlyForDateRange } from '@/lib/hanatour-price-collect'
import {
  buildHanatourKstTargetMonths,
  validateHanatourAdminMonthYm,
} from '@/lib/hanatour-departures'
import { parseHanatourPkgCdFromUrl } from '@/lib/hanatour-api-departures'
import { collectModetourApiDepartureInputs } from '@/lib/modetour-price-collect'
import { buildProductPublicDetailRenderModel } from '@/lib/product-public-detail/build-render-model'
import { buildProductDetailPageInclude } from '@/lib/product-detail-page-include'
import { isOnOrAfterPublicBookableMinDate } from '@/lib/public-bookable-date'
import * as priceRowsHanatour from '@/lib/product-departure-to-price-rows-hanatour'
import * as priceRowsModetour from '@/lib/product-departure-to-price-rows-modetour'
import * as priceRowsVerygoodtour from '@/lib/product-departure-to-price-rows-verygoodtour'
import * as priceRowsYbtour from '@/lib/product-departure-to-price-rows-ybtour'
import {
  addDaysUtcYmd,
  kstTodayYmd,
  RULE_A_WINDOW_DAYS,
} from '@/lib/product-sales-policy'
import { resolveHanatourAdminE2eMonthsForward, departureInputToYmd } from '@/lib/scrape-date-bounds'
import { collectYbtourApiOnlyForDateRange } from '@/lib/ybtour-price-collect'
import { collectVerygoodHxrOnlyForDateRange } from '@/lib/verygoodtour-price-collect'
import { normalizeVerygoodtourDetailUrlForCollect } from '@/lib/verygoodtour-detail-url-health'
import type { DepartureInput as VerygoodDepartureInput } from '@/lib/upsert-product-departures-verygoodtour'
import type { DepartureInput } from '@/lib/upsert-product-departures-ybtour'

const OUT_PATH = path.join(process.cwd(), 'ops', 'supplier-api-public-detail-parity.json')

type SweepSupplier = 'modetour' | 'hanatour' | 'ybtour' | 'verygoodtour'

type ProductRow = {
  id: string
  slug: string | null
  title: string
  originSource: string
  originUrl: string | null
  originCode: string | null
}

type LayerMismatch = {
  date: string
  field: string
  api?: number | string | null
  db?: number | string | null
  public?: number | string | null
  note?: string
}

type ItemResult = {
  slug: string | null
  id: string
  supplier: SweepSupplier
  dbDepartureCount: number
  detailLoadedDepartureCount: number
  truncatedByDetailTake: boolean
  liveApiRowCount: number
  l1_api_db: LayerMismatch[]
  l2_db_row: LayerMismatch[]
  l3_db_public: LayerMismatch[]
  status: 'ok' | 'mismatch' | 'skipped' | 'error'
  error: string | null
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

function ymdFromDate(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d).slice(0, 10)
}

function resolveDetailUrl(product: ProductRow): string | null {
  const stored = (product.originUrl ?? '').trim()
  if (stored.startsWith('http')) return stored
  const code = (product.originCode ?? '').trim()
  if (!code) return null
  const built = buildDetailUrl(product.originSource, code)
  return built.startsWith('http') ? built : null
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

function pricedApiMap(inputs: DepartureInput[], fromYmd: string, toYmd: string): Map<string, number> {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const map = new Map<string, number>()
  for (const x of inputs) {
    const dk = departureInputToYmd(x.departureDate)
    const price = x.adultPrice ?? 0
    if (dk == null || dk < lo || dk > hi || price <= 0) continue
    map.set(dk, price)
  }
  return map
}

function dbAdultMap(deps: ProductDeparture[], fromYmd: string, toYmd: string): Map<string, number> {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const map = new Map<string, number>()
  for (const d of deps) {
    const dk = ymdFromDate(d.departureDate)
    const price = d.adultPrice ?? 0
    if (dk < lo || dk > hi || price <= 0) continue
    map.set(dk, price)
  }
  return map
}

function comparePriceMaps(
  a: Map<string, number>,
  b: Map<string, number>,
  aLabel: string,
  bLabel: string,
): LayerMismatch[] {
  const out: LayerMismatch[] = []
  const dates = new Set([...a.keys(), ...b.keys()])
  for (const date of [...dates].sort()) {
    const av = a.get(date)
    const bv = b.get(date)
    if (av == null && bv != null) {
      out.push({ date, field: 'adultPrice', [aLabel]: null, [bLabel]: bv, note: `missing_in_${aLabel}` })
    } else if (av != null && bv == null) {
      out.push({ date, field: 'adultPrice', [aLabel]: av, [bLabel]: null, note: `missing_in_${bLabel}` })
    } else if (av != null && bv != null && av !== bv) {
      out.push({ date, field: 'adultPrice', [aLabel]: av, [bLabel]: bv, note: 'price_diff' })
    }
  }
  return out
}

async function liveApiInputs(
  supplier: SweepSupplier,
  product: ProductRow,
  fromYmd: string,
  toYmd: string,
): Promise<DepartureInput[]> {
  const url = resolveDetailUrl(product)
  if (!url) return []

  if (supplier === 'modetour') {
    const hit = await collectModetourApiDepartureInputs(url, fromYmd, toYmd)
    return hit.inputs
  }
  if (supplier === 'hanatour') {
    const monthYms = monthYmsForHorizon(fromYmd, toYmd)
    const hit = await collectHanatourApiOnlyForDateRange(url, fromYmd, toYmd, monthYms)
    return hit.inputs as DepartureInput[]
  }
  if (supplier === 'verygoodtour') {
    const normalized = normalizeVerygoodtourDetailUrlForCollect(url)
    const hit = await collectVerygoodHxrOnlyForDateRange(normalized, fromYmd, toYmd)
    return hit.inputs as VerygoodDepartureInput[]
  }
  const hit = await collectYbtourApiOnlyForDateRange(url, fromYmd, toYmd, {
    originCode: product.originCode,
  })
  return hit.inputs as DepartureInput[]
}

function priceRowsModule(supplier: SweepSupplier) {
  if (supplier === 'modetour') return priceRowsModetour
  if (supplier === 'hanatour') return priceRowsHanatour
  if (supplier === 'verygoodtour') return priceRowsVerygoodtour
  return priceRowsYbtour
}

async function main() {
  const supplierArg = readArg('--supplier') as SweepSupplier | null
  const slugArg = readArg('--slug')
  const limit = readIntArg('--limit', 99999)
  const skipLiveApi = process.argv.includes('--skip-live-api')

  const suppliers: SweepSupplier[] = supplierArg
    ? [supplierArg]
    : ['modetour', 'hanatour', 'ybtour', 'verygoodtour']

  if (supplierArg && !suppliers.includes(supplierArg)) {
    console.error(`invalid --supplier: ${supplierArg}`)
    process.exit(1)
  }

  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const fromUtc = new Date(`${fromYmd}T00:00:00.000Z`)
  const toUtc = new Date(`${toYmd}T23:59:59.999Z`)

  const results: ItemResult[] = []

  for (const supplier of suppliers) {
    let products = await prisma.product.findMany({
      where: { originSource: supplier, registrationStatus: 'registered' },
      select: {
        id: true,
        slug: true,
        title: true,
        originSource: true,
        originUrl: true,
        originCode: true,
      },
      orderBy: [{ slug: 'asc' }, { id: 'asc' }],
      take: limit,
    })

    if (slugArg) {
      products = products.filter((p) => p.slug === slugArg)
    }

    console.error(`[parity] ${supplier} products=${products.length} window=${fromYmd}..${toYmd}`)

    for (const product of products) {
      const item: ItemResult = {
        slug: product.slug,
        id: product.id,
        supplier,
        dbDepartureCount: 0,
        detailLoadedDepartureCount: 0,
        truncatedByDetailTake: false,
        liveApiRowCount: 0,
        l1_api_db: [],
        l2_db_row: [],
        l3_db_public: [],
        status: 'ok',
        error: null,
      }

      try {
        const dbDeps = await prisma.productDeparture.findMany({
          where: {
            productId: product.id,
            departureDate: { gte: fromUtc, lte: toUtc },
            adultPrice: { gt: 0 },
          },
          orderBy: { departureDate: 'asc' },
        })
        const dbBookable = dbDeps.filter((d) => isOnOrAfterPublicBookableMinDate(d.departureDate))
        item.dbDepartureCount = dbBookable.length

        let apiMap = new Map<string, number>()
        if (!skipLiveApi) {
          const url = resolveDetailUrl(product)
          if (!url) {
            item.status = 'skipped'
            item.error = 'no_detail_url'
          } else if (supplier === 'hanatour' && !parseHanatourPkgCdFromUrl(url)) {
            item.status = 'skipped'
            item.error = 'no_pkg_cd'
          } else {
            const apiInputs = await liveApiInputs(supplier, product, fromYmd, toYmd)
            item.liveApiRowCount = apiInputs.length
            apiMap = pricedApiMap(apiInputs, fromYmd, toYmd)
            const dbMapAll = dbAdultMap(dbDeps, fromYmd, toYmd)
            item.l1_api_db = comparePriceMaps(apiMap, dbMapAll, 'api', 'db')
          }
        }

        const full = await prisma.product.findFirst({
          where: { id: product.id },
          include: buildProductDetailPageInclude(),
        })
        const detailLoaded = (full?.departures ?? []) as ProductDeparture[]
        item.detailLoadedDepartureCount = detailLoaded.length
        item.truncatedByDetailTake = dbBookable.length > detailLoaded.length

        const mod = priceRowsModule(supplier)
        const rows = mod.productDeparturesToProductPriceRows(detailLoaded)
        const rowMap = new Map<string, number>()
        for (const r of rows) {
          const dk = r.date?.slice(0, 10)
          const ad = r.adult ?? r.priceAdult ?? 0
          if (dk && ad > 0) rowMap.set(dk, ad)
        }
        const detailDbMap = dbAdultMap(detailLoaded, fromYmd, toYmd)
        item.l2_db_row = comparePriceMaps(detailDbMap, rowMap, 'db', 'public')

        if (full) {
          const model = await buildProductPublicDetailRenderModel(full, null)
          const publicPrices =
            model.variant === 'air-hotel'
              ? (model.priceRowsForPublic ?? [])
              : (model.viewProduct?.prices ?? [])
          const publicMap = new Map<string, number>()
          for (const r of publicPrices) {
            const dk = r.date?.slice(0, 10)
            const ad = r.adult ?? r.priceAdult ?? 0
            if (dk && ad > 0 && isOnOrAfterPublicBookableMinDate(dk)) publicMap.set(dk, ad)
          }
          item.l3_db_public = comparePriceMaps(detailDbMap, publicMap, 'db', 'public')
        }

        const hasMismatch =
          item.l1_api_db.length > 0 || item.l2_db_row.length > 0 || item.l3_db_public.length > 0
        if (item.status === 'ok' && hasMismatch) item.status = 'mismatch'

        console.error(
          `[parity] ${product.slug ?? product.id} db=${item.dbDepartureCount} loaded=${item.detailLoadedDepartureCount} trunc=${item.truncatedByDetailTake} api=${item.liveApiRowCount} L1=${item.l1_api_db.length} L2=${item.l2_db_row.length} L3=${item.l3_db_public.length} ${item.status}`,
        )
      } catch (e) {
        item.status = 'error'
        item.error = (e instanceof Error ? e.message : String(e)).slice(0, 400)
        console.error(`[parity] ERROR ${product.slug ?? product.id}: ${item.error}`)
      }

      results.push(item)
    }
  }

  const summary = {
    finishedAt: new Date().toISOString(),
    fromYmd,
    toYmd,
    skipLiveApi,
    total: results.length,
    ok: results.filter((r) => r.status === 'ok').length,
    mismatch: results.filter((r) => r.status === 'mismatch').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    error: results.filter((r) => r.status === 'error').length,
    l1_mismatches: results.reduce((n, r) => n + r.l1_api_db.length, 0),
    l2_mismatches: results.reduce((n, r) => n + r.l2_db_row.length, 0),
    l3_mismatches: results.reduce((n, r) => n + r.l3_db_public.length, 0),
    items: results,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2), 'utf8')
  console.log(JSON.stringify({ ok: summary.mismatch === 0 && summary.error === 0, outFile: OUT_PATH, ...summary }, null, 2))

  await prisma.$disconnect()

  if (summary.mismatch > 0 || summary.error > 0) {
    process.exit(1)
  }
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
