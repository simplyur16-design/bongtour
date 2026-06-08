/**
 * 확장 공개 경로 속도 검수 — browse 변형·상품 샘플·Server-Timing.
 *
 *   PERF_BASE_URL=https://bongtour.com npx tsx scripts/audit-public-route-speed-extended.ts
 */
import './load-env-for-scripts'
import { prisma } from '../lib/prisma'
import { productsBrowseBuildPayload, browsePerfLastPhases } from '../lib/products-browse-build-payload'
import {
  buildOverseasHubBrowseQueryKey,
  buildAirHotelHubBrowseQueryKey,
} from '../lib/products-browse-hub-query'

const THRESHOLD_MS = 1000

type Row = { label: string; kind: string; ms: number; status?: number; detail?: string }

async function measureHttp(
  base: string,
  path: string,
  label: string,
  kind: string,
  accept = 'text/html',
): Promise<Row> {
  const t0 = performance.now()
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: accept, 'User-Agent': 'BongTourSpeedAudit/2.0' },
      redirect: 'follow',
    })
    const body = await res.text()
    const ms = Math.round(performance.now() - t0)
    const timing = res.headers.get('Server-Timing') ?? ''
    return {
      label,
      kind,
      ms,
      status: res.status,
      detail: `${(body.length / 1024).toFixed(0)}KB${timing ? ` | ${timing}` : ''}`,
    }
  } catch (e) {
    return {
      label,
      kind,
      ms: Math.round(performance.now() - t0),
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}

async function measureBrowseCold(label: string, queryKey: string): Promise<Row> {
  process.env.BONGTOUR_PERF_LOG = '1'
  const t0 = performance.now()
  await productsBrowseBuildPayload(queryKey)
  const ms = Math.round(performance.now() - t0)
  const p = browsePerfLastPhases
  const detail = p
    ? `db=${p.dbMs} filter=${p.filterMs} score=${p.scoreMs} map=${p.mapMs} rows=${p.rowCount}`
    : ''
  return { label, kind: 'browse-cold', ms, detail }
}

async function sampleProducts() {
  const registered = await prisma.product.findMany({
    where: { registrationStatus: 'registered', slug: { not: null } },
    select: {
      id: true,
      slug: true,
      title: true,
      publicDetailPayloadJson: true,
      _count: { select: { departures: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  const withPayload = registered
    .map((p) => ({
      ...p,
      payloadBytes: p.publicDetailPayloadJson
        ? Buffer.byteLength(JSON.stringify(p.publicDetailPayloadJson), 'utf8')
        : 0,
    }))
    .sort((a, b) => b.payloadBytes - a.payloadBytes)

  const byDepartures = [...registered].sort((a, b) => b._count.departures - a._count.departures)

  const picks = new Map<string, (typeof registered)[0] & { payloadBytes?: number }>()
  for (const p of withPayload.slice(0, 3)) picks.set(p.id, p)
  for (const p of byDepartures.slice(0, 3)) picks.set(p.id, { ...p, payloadBytes: 0 })
  for (const p of registered.slice(0, 2)) picks.set(p.id, { ...p, payloadBytes: 0 })

  return [...picks.values()]
}

const BROWSE_VARIANTS: { label: string; queryKey: string }[] = [
  { label: '해외 허브', queryKey: buildOverseasHubBrowseQueryKey('scope=overseas') },
  { label: '항공+호텔', queryKey: buildAirHotelHubBrowseQueryKey('scope=overseas&type=air-hotel') },
  { label: '일본 필터', queryKey: buildOverseasHubBrowseQueryKey('scope=overseas&country=jp') },
  { label: '유럽 필터', queryKey: buildOverseasHubBrowseQueryKey('scope=overseas&country=eu') },
  { label: '예산 필터', queryKey: buildOverseasHubBrowseQueryKey('scope=overseas&budgetPerPersonMax=1500000') },
  { label: '정렬 최신', queryKey: buildOverseasHubBrowseQueryKey('scope=overseas&sort=latest') },
]

const EXTRA_PAGES = [
  '/travel/overseas?country=jp',
  '/travel/overseas?country=eu',
  '/travel/air-hotel',
  '/admin',
  '/admin/products',
]

async function main() {
  const base = (process.env.PERF_BASE_URL ?? 'https://bongtour.com').replace(/\/$/, '')
  const rows: Row[] = []

  console.log(`=== browse cold build (${base} DB) ===\n`)
  for (const v of BROWSE_VARIANTS) {
    const row = await measureBrowseCold(`browse ${v.label}`, v.queryKey)
    rows.push(row)
    console.log(`${row.ms}ms\t${row.label}\t${row.detail ?? ''}`)
  }

  console.log(`\n=== HTTP pages (${base}) ===\n`)
  const health = await measureHttp(base, '/api/health', 'health', 'api', 'application/json')
  if (health.status !== 200) {
    console.log(`서버 비정상: ${health.status} ${health.detail}`)
    await prisma.$disconnect()
    return
  }

  for (const path of EXTRA_PAGES) {
    const row = await measureHttp(base, path, `page ${path}`, 'http-page')
    rows.push(row)
    console.log(`${row.ms}ms\t${row.status}\t${row.label}\t${row.detail ?? ''}`)
  }

  for (const v of BROWSE_VARIANTS) {
    const row = await measureHttp(
      base,
      `/api/products/browse?${v.queryKey}`,
      `api browse ${v.label}`,
      'http-api',
      'application/json',
    )
    rows.push(row)
    console.log(`${row.ms}ms\t${row.status}\t${row.label}\t${row.detail ?? ''}`)
  }

  console.log(`\n=== 상품 상세 샘플 (${base}) ===\n`)
  const products = await sampleProducts()
  for (const p of products) {
    const slug = p.slug!
    const row = await measureHttp(
      base,
      `/products/${slug}`,
      `상세 ${slug} (${p._count.departures}출발, ${Math.round((p as { payloadBytes?: number }).payloadBytes ?? 0) / 1024}KB payload)`,
      'http-page',
    )
    rows.push(row)
    console.log(`${row.ms}ms\t${row.status}\t${row.label}\t${row.detail ?? ''}`)
  }

  const over = rows.filter((r) => r.ms > THRESHOLD_MS).sort((a, b) => b.ms - a.ms)
  console.log('\n=== 1초 초과 (내림차순) ===\n')
  if (!over.length) console.log('없음')
  else for (const r of over) console.log(`${r.ms}ms\t[${r.kind}]\t${r.label}\t${r.detail ?? ''}`)

  const worst = rows.sort((a, b) => b.ms - a.ms)[0]
  console.log(`\n최악: ${worst.ms}ms — ${worst.label}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
