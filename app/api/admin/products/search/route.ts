import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * GET /api/admin/products/search?q=...&limit=10
 * 카드뉴스 편 연결 상품 검색 — title/country/city 부분 일치
 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10) || 10))

  if (!q) {
    return NextResponse.json({ items: [] })
  }

  const items = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { primaryDestination: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      title: true,
      country: true,
      city: true,
      primaryDestination: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ items })
}
