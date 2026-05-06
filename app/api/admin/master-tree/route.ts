import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/master-tree — Continent → Country → City (F-1 드릴다운)
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const continents = await prisma.continent.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      continentKey: true,
      koreanLabel: true,
      sortOrder: true,
      countries: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          countryKey: true,
          koreanLabel: true,
          sortOrder: true,
          continentKey: true,
          cities: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              cityKey: true,
              koreanLabel: true,
              sortOrder: true,
              countryKey: true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ continents })
}
