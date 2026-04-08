import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * PATCH /api/admin/photo-pool/reorder. 인증: 관리자.
 */
export async function PATCH(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = (await request.json()) as { order?: Array<{ id: string; sortOrder: number }> }
    const order = body.order
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: 'order 배열 필요' }, { status: 400 })
    }

    await prisma.$transaction(
      order.map(({ id, sortOrder }) =>
        prisma.photoPool.update({
          where: { id },
          data: { sortOrder },
        })
      )
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('photo-pool reorder:', e)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
}
