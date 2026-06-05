/**
 * 공개 경로·browse API 속도 검수 — 1초(1000ms) 초과 구간 보고.
 *
 *   npx tsx scripts/audit-public-route-speed.ts
 *   PERF_BASE_URL=http://localhost:3000 npx tsx scripts/audit-public-route-speed.ts --http
 *   BONGTOUR_PERF_LOG=1 npx tsx scripts/audit-public-route-speed.ts --browse-only
 */
import './load-env-for-scripts'
import { prisma } from '../lib/prisma'
import { productsBrowseBuildPayload } from '../lib/products-browse-build-payload'
import { browsePerfLastPhases } from '../lib/products-browse-build-payload'
import {
  buildAirHotelHubBrowseQueryKey,
  buildDomesticHubBrowseQueryKey,
  buildOverseasHubBrowseQueryKey,
} from '../lib/products-browse-hub-query'
import { CACHE_WARM_ROUTES } from '../lib/cache-warm-routes'

const THRESHOLD_MS = 1000

type Row = {
  label: string
  kind: 'browse-build' | 'http-page' | 'http-api'
  ms: number
  status?: number
  detail?: string
}

const BROWSE_CASES: { label: string; queryKey: string }[] = [
  {
    label: 'browse 해외 허브 (cold build)',
    queryKey: buildOverseasHubBrowseQueryKey('scope=overseas'),
  },
  {
    label: 'browse 항공+호텔 허브 (cold build)',
    queryKey: buildAirHotelHubBrowseQueryKey('scope=overseas&type=air-hotel'),
  },
  {
    label: 'browse 국내 허브 (cold build)',
    queryKey: buildDomesticHubBrowseQueryKey('scope=domestic'),
  },
]

async function measureBrowseCold(label: string, queryKey: string): Promise<Row> {
  process.env.BONGTOUR_PERF_LOG = '1'
  const t0 = performance.now()
  const payload = await productsBrowseBuildPayload(queryKey)
  const ms = Math.round(performance.now() - t0)
  const phases = browsePerfLastPhases
  const detail = phases
    ? `db=${phases.dbMs}ms filter=${phases.filterMs}ms score=${phases.scoreMs}ms map=${phases.mapMs}ms rows=${phases.rowCount} final=${phases.finalCount}`
    : `total=${payload.total}`
  return { label, kind: 'browse-build', ms, detail }
}

async function measureHttp(url: string, label: string, kind: 'http-page' | 'http-api'): Promise<Row> {
  const t0 = performance.now()
  try {
    const res = await fetch(url, {
      headers: {
        Accept: kind === 'http-page' ? 'text/html' : 'application/json',
        'User-Agent': 'BongTourSpeedAudit/1.0',
      },
      redirect: 'follow',
    })
    const body = await res.text()
    const ms = Math.round(performance.now() - t0)
    return {
      label,
      kind,
      ms,
      status: res.status,
      detail: `${(body.length / 1024).toFixed(0)}KB`,
    }
  } catch (e) {
    const ms = Math.round(performance.now() - t0)
    return {
      label,
      kind,
      ms,
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}

async function sampleProductPaths(): Promise<string[]> {
  const p = await prisma.product.findFirst({
    where: { registrationStatus: 'registered', slug: { not: null } },
    select: { slug: true, id: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (!p?.slug) return []
  return [`/products/${p.slug}`, `/products/${p.id}`]
}

async function main() {
  const httpOnly = process.argv.includes('--http')
  const browseOnly = process.argv.includes('--browse-only')
  const base = (process.env.PERF_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const rows: Row[] = []

  if (!httpOnly) {
    console.log('=== browse payload (DB cold build) ===\n')
    for (const c of BROWSE_CASES) {
      const row = await measureBrowseCold(c.label, c.queryKey)
      rows.push(row)
      console.log(`${row.ms}ms\t${row.label}\t${row.detail ?? ''}`)
    }
  }

  if (!browseOnly) {
    console.log(`\n=== HTTP (${base}) ===\n`)
    const probe = await measureHttp(`${base}/api/health`, 'health', 'http-api')
    if (probe.status !== 200 && !probe.detail?.includes('fetch')) {
      console.log(`서버 응답 이상 — health ${probe.status} ${probe.detail}`)
    } else if (probe.detail?.includes('fetch') || probe.status === undefined) {
      console.log(`HTTP 스킵: 서버 미기동 (${probe.detail}). PERF_BASE_URL 로 dev/start 후 --http 재실행.`)
    } else {
      for (const path of CACHE_WARM_ROUTES) {
        const row = await measureHttp(`${base}${path}`, `page ${path}`, 'http-page')
        rows.push(row)
        console.log(`${row.ms}ms\t${row.status ?? '-'}\t${row.label}\t${row.detail ?? ''}`)
      }
      for (const c of BROWSE_CASES) {
        const row = await measureHttp(`${base}/api/products/browse?${c.queryKey}`, `api ${c.label}`, 'http-api')
        rows.push(row)
        console.log(`${row.ms}ms\t${row.status ?? '-'}\t${row.label}\t${row.detail ?? ''}`)
      }
      const productPaths = await sampleProductPaths()
      for (const path of productPaths) {
        const row = await measureHttp(`${base}${path}`, `page ${path}`, 'http-page')
        rows.push(row)
        console.log(`${row.ms}ms\t${row.status ?? '-'}\t${row.label}\t${row.detail ?? ''}`)
      }
    }
  }

  const over = rows.filter((r) => r.ms > THRESHOLD_MS)
  console.log('\n=== 1초 초과 ===\n')
  if (over.length === 0) {
    console.log('없음 (측정된 구간 기준).')
  } else {
    for (const r of over) {
      console.log(`${r.ms}ms\t[${r.kind}]\t${r.label}\t${r.detail ?? ''}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
