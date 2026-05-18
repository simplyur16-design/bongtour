import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

const OVERSEAS_WHERE = {
  NOT: { travelScope: 'domestic' as const },
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [byOriginSource, byStatus, byCountryKey, byCityKey, countries, cities] = await Promise.all([
    prisma.product.groupBy({
      by: ['originSource'],
      where: OVERSEAS_WHERE,
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ['registrationStatus', 'originSource'],
      where: OVERSEAS_WHERE,
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ['countryKey'],
      where: { ...OVERSEAS_WHERE, countryKey: { not: null }, registrationStatus: 'registered' },
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ['cityKey'],
      where: { ...OVERSEAS_WHERE, cityKey: { not: null }, registrationStatus: 'registered' },
      _count: { _all: true },
    }),
    prisma.country.findMany({ select: { countryKey: true, koreanLabel: true } }),
    prisma.city.findMany({ select: { cityKey: true, koreanLabel: true, countryKey: true } }),
  ])

  const countryLabel = new Map(countries.map((c) => [c.countryKey, c.koreanLabel]))
  const cityMeta = new Map(cities.map((c) => [c.cityKey, c]))

  const supplierRows = byOriginSource
    .map((r) => {
      const source = (r.originSource ?? '').trim() || '(미지정)'
      const statusCounts: Record<string, number> = {}
      for (const row of byStatus) {
        if ((row.originSource ?? '').trim() !== (r.originSource ?? '').trim()) continue
        const st = (row.registrationStatus ?? '').trim() || 'pending'
        statusCounts[st] = row._count._all
      }
      return {
        originSource: source,
        total: r._count._all,
        registered: statusCounts.registered ?? 0,
        pending: statusCounts.pending ?? 0,
        onHold: statusCounts.on_hold ?? 0,
        rejected: statusCounts.rejected ?? 0,
        autoUnpublished: statusCounts.auto_unpublished ?? 0,
      }
    })
    .sort((a, b) => b.registered - a.registered || b.total - a.total)

  const countryRows = byCountryKey
    .map((r) => ({
      countryKey: r.countryKey!,
      koreanLabel: countryLabel.get(r.countryKey!) ?? r.countryKey!,
      registeredCount: r._count._all,
    }))
    .sort((a, b) => b.registeredCount - a.registeredCount)

  const cityRows = byCityKey
    .map((r) => {
      const meta = cityMeta.get(r.cityKey!)
      return {
        cityKey: r.cityKey!,
        koreanLabel: meta?.koreanLabel ?? r.cityKey!,
        countryKey: meta?.countryKey ?? null,
        countryLabel: meta?.countryKey ? (countryLabel.get(meta.countryKey) ?? meta.countryKey) : null,
        registeredCount: r._count._all,
      }
    })
    .sort((a, b) => b.registeredCount - a.registeredCount)

  const totals = supplierRows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      registered: acc.registered + r.registered,
    }),
    { total: 0, registered: 0 },
  )

  return NextResponse.json({
    ok: true,
    totals,
    suppliers: supplierRows,
    countries: countryRows,
    cities: cityRows.slice(0, 80),
  })
}
