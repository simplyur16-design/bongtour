import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import type { OverseasRegionGroupNode } from '@/lib/overseas-location-tree.types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/overseas-tree — DB 마스터 기준 해외 트리(메가메뉴 타입 호환).
 * 비어 있으면 `{ tree: [] }` — 클라이언트는 코드 SSOT 트리로 폴백.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const groups = await prisma.overseasGroup.findMany({ orderBy: { sortOrder: 'asc' } })
  if (groups.length === 0) {
    return NextResponse.json({ tree: [] as OverseasRegionGroupNode[] })
  }

  const [countries, nodes] = await Promise.all([
    prisma.overseasCountry.findMany({
      where: { isActive: true },
      orderBy: [{ groupKey: 'asc' }, { sortOrder: 'asc' }],
    }),
    prisma.overseasNode.findMany({
      where: { isActive: true },
      orderBy: [{ countryKey: 'asc' }, { sortOrder: 'asc' }],
    }),
  ])

  const nodesByCountry = new Map<string, typeof nodes>()
  for (const n of nodes) {
    const arr = nodesByCountry.get(n.countryKey) ?? []
    arr.push(n)
    nodesByCountry.set(n.countryKey, arr)
  }

  const countriesByGroup = new Map<string, typeof countries>()
  for (const c of countries) {
    const arr = countriesByGroup.get(c.groupKey) ?? []
    arr.push(c)
    countriesByGroup.set(c.groupKey, arr)
  }

  const tree: OverseasRegionGroupNode[] = groups.map((g) => ({
    groupKey: g.groupKey,
    groupLabel: g.koreanLabel,
    countries: (countriesByGroup.get(g.groupKey) ?? []).map((c) => ({
      countryKey: c.countryKey,
      countryLabel: c.koreanLabel,
      children: (nodesByCountry.get(c.countryKey) ?? []).map((n) => ({
        nodeKey: n.nodeKey,
        nodeLabel: n.koreanLabel,
      })),
    })),
  }))

  return NextResponse.json({ tree })
}
