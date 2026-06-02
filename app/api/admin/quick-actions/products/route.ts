import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminToolApi } from '@/lib/require-admin-tool'

/**
 * GET /api/admin/quick-actions/products?q= — 상품 통합 검색 (ADMIN·STAFF)
 */
export async function GET(request: Request) {
  const gate = await requireAdminToolApi()
  if (gate instanceof NextResponse) return gate

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ products: [] })
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { originCode: { contains: q, mode: 'insensitive' } },
          { id: q },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        originCode: true,
        registrationStatus: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({ products })
  } catch (e) {
    console.error('[GET /api/admin/quick-actions/products]', e)
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
