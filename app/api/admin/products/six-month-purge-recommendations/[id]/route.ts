import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'
import { purgeSixMonthNoPriceProduct } from '@/lib/product-six-month-price-purge'
import { revalidateProductDetailCaches } from '@/lib/revalidate-product-detail-caches'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'

type Ctx = { params: Promise<{ id: string }> }

/**
 * DELETE /api/admin/products/six-month-purge-recommendations/[id]
 * 삭제 권고 상품 1건 DB 삭제 (예약 연결 시 거절).
 */
export async function DELETE(_request: Request, ctx: Ctx) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  try {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, slug: true },
    })
    if (!existing) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    const result = await purgeSixMonthNoPriceProduct(prisma, id)
    if (result.status === 'skipped_bookings') {
      return NextResponse.json(
        {
          ok: false,
          error: `예약 ${result.bookingCount}건이 연결되어 삭제할 수 없습니다.`,
          bookingCount: result.bookingCount,
        },
        { status: 400 },
      )
    }
    if (result.status === 'not_found') {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    try {
      await revalidateProductDetailCaches(id, existing.slug)
      revalidateProductListingCaches()
    } catch {
      /* non-Next test context */
    }

    return NextResponse.json({ ok: true, productId: id })
  } catch (e) {
    console.error('[DELETE /api/admin/products/six-month-purge-recommendations/[id]]', e)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
