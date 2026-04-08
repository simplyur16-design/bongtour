import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * GET /api/admin/products/list/options — 필터 옵션. 인증: 관리자.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const [airlines, destinations, primaryRegions, displayCategories] = await Promise.all([
      prisma.product.findMany({
        where: { airline: { not: null } },
        select: { airline: true },
        distinct: ['airline'],
        orderBy: { airline: 'asc' },
      }),
      prisma.product.findMany({
        where: { destination: { not: null } },
        select: { destination: true },
        distinct: ['destination'],
        orderBy: { destination: 'asc' },
      }),
      prisma.product.findMany({
        where: { primaryRegion: { not: null } },
        select: { primaryRegion: true },
        distinct: ['primaryRegion'],
        orderBy: { primaryRegion: 'asc' },
      }),
      prisma.product.findMany({
        where: { displayCategory: { not: null } },
        select: { displayCategory: true },
        distinct: ['displayCategory'],
        orderBy: { displayCategory: 'asc' },
      }),
    ])
    return NextResponse.json({
      airlines: airlines.map((a) => a.airline).filter((a): a is string => a != null),
      destinations: destinations.map((d) => d.destination).filter((d): d is string => d != null),
      primaryRegions: primaryRegions.map((r) => r.primaryRegion).filter((r): r is string => r != null),
      displayCategories: displayCategories.map((c) => c.displayCategory).filter((c): c is string => c != null),
    })
  } catch (e) {
    console.error('products/list/options:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
