import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/admin/products/[id]/sync. 인증: 관리자.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id } = await params
    const productId = id && typeof id === 'string' ? id.trim() : ''
    if (!productId) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json({ error: '상품 없음' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      productId,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
