/**
 * registered 해외 상품 — RULE_A 창 안 유료 출발일 갭 점검.
 * npx tsx scripts/audit-departure-price-gaps.ts
 */
import './load-env-for-scripts'
import { prisma } from '@/lib/prisma'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

async function main() {
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
      originCode: true,
      originUrl: true,
      departures: {
        where: {
          departureDate: { gte: fromDate, lte: toDate },
          adultPrice: { gt: 0 },
        },
        select: { departureDate: true, adultPrice: true, syncedAt: true },
        orderBy: { departureDate: 'asc' },
      },
    },
    orderBy: { slug: 'asc' },
  })

  type Row = {
    slug: string | null
    originSource: string | null
    originCode: string | null
    originUrl: string | null
    title: string
    pricedWindow: number
    nextDep: string | null
    lastSync: string | null
  }

  const rows: Row[] = products.map((p) => {
    const deps = p.departures
    const lastSync = deps.reduce<Date | null>((acc, d) => {
      if (!d.syncedAt) return acc
      if (!acc || d.syncedAt > acc) return d.syncedAt
      return acc
    }, null)
    return {
      slug: p.slug,
      originSource: p.originSource,
      originCode: p.originCode,
      originUrl: p.originUrl,
      title: (p.title ?? '').slice(0, 80),
      pricedWindow: deps.length,
      nextDep: deps[0]?.departureDate
        ? deps[0].departureDate.toISOString().slice(0, 10)
        : null,
      lastSync: lastSync?.toISOString() ?? null,
    }
  })

  const zero = rows.filter((r) => r.pricedWindow === 0)
  const thin = rows.filter((r) => r.pricedWindow > 0 && r.pricedWindow < 3)
  const bySrc = (arr: Row[]) => {
    const m: Record<string, number> = {}
    for (const r of arr) {
      const k = r.originSource || 'null'
      m[k] = (m[k] ?? 0) + 1
    }
    return m
  }

  const report = {
    at: new Date().toISOString(),
    today,
    to,
    horizonDays: RULE_A_WINDOW_DAYS,
    total: rows.length,
    zeroPricedWindow: zero.length,
    thinLt3: thin.length,
    zeroBySource: bySrc(zero),
    thinBySource: bySrc(thin),
    zero,
    thin,
  }

  const dir = path.join(process.cwd(), 'scripts', 'data')
  mkdirSync(dir, { recursive: true })
  const out = path.join(dir, `audit-departure-price-gaps-${Date.now()}.json`)
  writeFileSync(out, JSON.stringify(report, null, 2), 'utf8')

  console.log(
    JSON.stringify(
      {
        today,
        to,
        total: report.total,
        zeroPricedWindow: report.zeroPricedWindow,
        thinLt3: report.thinLt3,
        zeroBySource: report.zeroBySource,
        thinBySource: report.thinBySource,
        zeroSample: zero.slice(0, 30).map((r) => ({
          slug: r.slug,
          src: r.originSource,
          code: r.originCode,
          title: r.title,
          url: r.originUrl?.slice(0, 80),
        })),
        reportPath: out,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
