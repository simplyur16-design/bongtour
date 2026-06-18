/**
 * 공급사별 달력 스크래퍼 1상품 스모크 — 지평선(180일) 커버리지 점검.
 * npx tsx scripts/smoke-calendar-scrapers-inspect.ts [--api-base http://localhost:3000]
 */
import './load-env-for-scripts'

import { spawnSync } from 'node:child_process'
import { prisma } from '../lib/prisma'
import { buildDetailUrl, scrapeLiveCalendar } from '../lib/admin-departure-rescrape'
import { calendarPriceHorizonDateRangeYmd, CALENDAR_PRICE_HORIZON_DAYS } from '../lib/calendar-price-horizon'
import { collectHanatourDepartureInputsForDateRange } from '../lib/hanatour-departures'
import { collectKyowontourCalendarRange } from '../lib/kyowontour-departures'
import {
  collectLottetourCalendarRange,
  parseLottetourEvtListCollectionHints,
} from '../lib/lottetour-departures'
import { collectModetourDepartureInputsForDateRange } from '../lib/modetour-departures'
import { normalizeSupplierOrigin } from '../lib/normalize-supplier-origin'
import type { CanonicalOverseasSupplierKey } from '../lib/overseas-supplier-canonical-keys'
import { getAdminServiceBearerSecret } from '../lib/admin-secrets'
import { resolvePythonExecutable } from '../lib/resolve-python-executable'
import { departureInputToYmd } from '../lib/scrape-date-bounds'
import { addCalendarDaysYmd, seoulCalendarYmd } from '../lib/scraper-schedule-strategy'
import { isVerygoodtourDetailUrlExpired } from '../lib/verygoodtour-detail-url-health'

const SUPPLIERS: CanonicalOverseasSupplierKey[] = [
  'hanatour',
  'modetour',
  'ybtour',
  'verygoodtour',
  'lottetour',
  'kyowontour',
]

type Row = {
  supplier: string
  productId: string
  title: string
  path: string
  ok: boolean
  rowCount: number
  minYmd: string | null
  maxYmd: string | null
  horizonTo: string
  daysShortOfHorizon: number | null
  elapsedMs: number
  error: string | null
}

function parseApiBase(): string {
  const i = process.argv.indexOf('--api-base')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!.replace(/\/$/, '')
  return (process.env.BONGTOUR_API_BASE ?? 'http://localhost:3000').replace(/\/$/, '')
}

function ymdsFromDates(dates: string[]): { min: string | null; max: string | null; count: number } {
  const sorted = [...dates].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  if (!sorted.length) return { min: null, max: null, count: 0 }
  return { min: sorted[0]!, max: sorted[sorted.length - 1]!, count: sorted.length }
}

async function pickProduct(supplier: CanonicalOverseasSupplierKey) {
  const now = new Date()
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      originCode: { not: '' },
      departures: {
        some: {
          departureDate: { gte: now },
          adultPrice: { gte: 100_000 },
        },
      },
    },
    select: {
      id: true,
      title: true,
      originSource: true,
      originCode: true,
      originUrl: true,
      rawMeta: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 80,
  })
  return rows.find((r) => normalizeSupplierOrigin(r.originSource) === supplier) ?? null
}

async function smokeModetourApi(
  productId: string,
  fromYmd: string,
  toYmd: string,
  apiBase: string
): Promise<{ dates: string[]; path: string; error: string | null }> {
  const bearer = getAdminServiceBearerSecret().trim() || (process.env.ADMIN_BYPASS_SECRET ?? '').trim()
  if (!bearer) {
    return { dates: [], path: 'modetour-api-route', error: 'no admin bearer' }
  }
  const url = `${apiBase}/api/admin/products/${productId}/calendar-scrape-modetour-api`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fromYmd, toYmd }),
    })
    const text = await res.text()
    if (!res.ok) {
      return { dates: [], path: 'modetour-api-route', error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }
    const j = JSON.parse(text) as { items?: Array<{ date?: string }> }
    const dates = (j.items ?? []).map((x) => String(x.date ?? '').slice(0, 10)).filter(Boolean)
    return { dates, path: 'modetour-api-route', error: null }
  } catch (e) {
    return { dates: [], path: 'modetour-api-route', error: e instanceof Error ? e.message : String(e) }
  }
}

async function runSupplier(
  supplier: CanonicalOverseasSupplierKey,
  horizon: { fromYmd: string; toYmd: string },
  apiBase: string
): Promise<Row> {
  const t0 = Date.now()
  const base: Row = {
    supplier,
    productId: '',
    title: '',
    path: '',
    ok: false,
    rowCount: 0,
    minYmd: null,
    maxYmd: null,
    horizonTo: horizon.toYmd,
    daysShortOfHorizon: null,
    elapsedMs: 0,
    error: null,
  }

  const p = await pickProduct(supplier)
  if (!p) {
    return { ...base, error: 'no registered product with future priced departure', elapsedMs: Date.now() - t0 }
  }
  base.productId = p.id
  base.title = (p.title ?? '').slice(0, 60)

  const detailUrl =
    (p.originUrl ?? '').trim().startsWith('http')
      ? p.originUrl!.trim()
      : buildDetailUrl(p.originSource ?? supplier, p.originCode ?? '')

  try {
    let dates: string[] = []
    let path = ''

    if (supplier === 'modetour') {
      path = 'modetour-b2c-direct'
      dates = (
        await collectModetourDepartureInputsForDateRange(detailUrl, horizon.fromYmd, horizon.toYmd)
      )
        .map((x) => departureInputToYmd(x.departureDate))
        .filter((d): d is string => d != null)

      const viaApi = await smokeModetourApi(p.id, horizon.fromYmd, horizon.toYmd, apiBase)
      if (!viaApi.error && viaApi.dates.length > 0) {
        path = `${path}+${viaApi.path}`
      } else if (viaApi.error) {
        path = `${path} (api-route-fail: ${viaApi.error.slice(0, 80)})`
      }
    } else if (supplier === 'hanatour') {
      path = 'hanatour-e2e-range'
      const inputs = await collectHanatourDepartureInputsForDateRange(
        detailUrl,
        horizon.fromYmd,
        horizon.toYmd
      )
      dates = inputs.map((x) => departureInputToYmd(x.departureDate)).filter((d): d is string => d != null)
    } else if (supplier === 'verygoodtour') {
      if (await isVerygoodtourDetailUrlExpired(detailUrl)) {
        return {
          ...base,
          path: 'verygood-detail-url-stale',
          elapsedMs: Date.now() - t0,
          error: 'verygoodtour detail URL expired (404) — re-register ProCode',
        }
      }
      path = 'verygoodtour-e2e-live'
      const cal = await scrapeLiveCalendar(detailUrl, 'verygoodtour', {
        VERYGOOD_DATE_FROM: horizon.fromYmd,
        VERYGOOD_DATE_TO: horizon.toYmd,
      })
      dates = cal.rows.map((r) => String(r.date ?? '').slice(0, 10)).filter((d) => d.length === 10)
    } else if (supplier === 'ybtour') {
      path = 'ybtour-e2e-live'
      const cal = await scrapeLiveCalendar(detailUrl, 'ybtour', {
        YBTOUR_DATE_FROM: horizon.fromYmd,
        YBTOUR_DATE_TO: horizon.toYmd,
      })
      dates = cal.rows.map((r) => String(r.date ?? '').slice(0, 10)).filter((d) => d.length === 10)
    } else if (supplier === 'lottetour') {
      path = 'lottetour-http-range'
      const hints = parseLottetourEvtListCollectionHints({
        originUrl: p.originUrl,
        rawMeta: p.rawMeta,
      })
      if (!hints.godId || !hints.menuNos) {
        throw new Error('lottetour URL hints missing (godId/menuNos)')
      }
      const { rows } = await collectLottetourCalendarRange(
        { godId: hints.godId, menuNos: hints.menuNos },
        { dateFrom: horizon.fromYmd.slice(0, 7), monthCount: 6, log: false }
      )
      dates = rows
        .map((r) => String(r.departDate ?? '').slice(0, 10))
        .filter((d) => d >= horizon.fromYmd && d <= horizon.toYmd)
    } else if (supplier === 'kyowontour') {
      path = 'kyowontour-e2e-range'
      const code = (p.originCode ?? '').trim()
      const [y, m] = horizon.fromYmd.split('-').map(Number)
      const { rows } = await collectKyowontourCalendarRange(code, {
        startMonth: new Date(y, m - 1, 1),
        monthCount: 6,
      })
      dates = rows
        .map((r) => String(r.departDate ?? '').slice(0, 10))
        .filter((d) => d >= horizon.fromYmd && d <= horizon.toYmd)
    }

    const stat = ymdsFromDates(dates)
    const daysShort =
      stat.max != null
        ? Math.max(0, Math.round((new Date(horizon.toYmd).getTime() - new Date(stat.max).getTime()) / 86_400_000))
        : null

    return {
      ...base,
      path,
      ok: stat.count > 0,
      rowCount: stat.count,
      minYmd: stat.min,
      maxYmd: stat.max,
      daysShortOfHorizon: daysShort,
      elapsedMs: Date.now() - t0,
      error: stat.count > 0 ? null : '0 priced rows in horizon window',
    }
  } catch (e) {
    return {
      ...base,
      elapsedMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

async function main() {
  const apiBase = parseApiBase()
  const today = seoulCalendarYmd()
  const horizon = calendarPriceHorizonDateRangeYmd(today)
  const py = resolvePythonExecutable()

  console.log('=== Calendar scraper smoke inspect ===')
  console.log(JSON.stringify({ today, horizon, horizonDays: CALENDAR_PRICE_HORIZON_DAYS, apiBase, python: py }, null, 2))

  const ping = await fetch(`${apiBase}/api/admin/scheduler/calendar-audit`, {
    headers: { Authorization: `Bearer ${getAdminServiceBearerSecret().trim() || process.env.ADMIN_BYPASS_SECRET || ''}` },
  }).catch(() => null)
  console.log(`api ping calendar-audit: ${ping ? ping.status : 'unreachable'}`)

  const results: Row[] = []
  for (const s of SUPPLIERS) {
    console.log(`\n--- ${s} ---`)
    const row = await runSupplier(s, horizon, apiBase)
    results.push(row)
    console.log(JSON.stringify(row, null, 2))
  }

  const okN = results.filter((r) => r.ok).length
  console.log('\n=== Summary ===')
  console.log(`pass ${okN}/${results.length}`)
  for (const r of results) {
    const cover =
      r.maxYmd != null
        ? `max=${r.maxYmd} shortOfHorizon=${r.daysShortOfHorizon ?? '?'}d`
        : 'no dates'
    console.log(
      `${r.ok ? 'OK' : 'FAIL'} ${r.supplier.padEnd(14)} rows=${String(r.rowCount).padStart(4)} ${cover} ${(r.elapsedMs / 1000).toFixed(1)}s ${r.error ?? r.path}`
    )
  }

  await prisma.$disconnect()
  process.exit(okN === results.length ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
