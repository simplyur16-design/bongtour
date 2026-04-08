import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { applyHanatourFullSyncToProduct } from '@/lib/hanatour-full-sync'
import { requireAdmin } from '@/lib/require-admin'

/**
 * POST { productId, detailUrl?, maxMonths? }
 * 하나투어 상품: Python sync-full → Product 확장 필드 + ItineraryDay + ProductDeparture.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let body: { productId?: string; detailUrl?: string | null; maxMonths?: number }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const productId = (body.productId ?? '').trim()
  if (!productId) {
    return NextResponse.json({ error: 'productId가 필요합니다.' }, { status: 400 })
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, originUrl: true, originCode: true, originSource: true },
  })
  if (!product) {
    return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
  }

  const detailUrl =
    (body.detailUrl ?? '').trim() ||
    (product.originUrl ?? '').trim() ||
    `https://www.hanatour.com/package/detail?pkgCd=${encodeURIComponent(product.originCode)}`

  if (!detailUrl.startsWith('http')) {
    return NextResponse.json({ error: '유효한 detailUrl이 없습니다.' }, { status: 400 })
  }

  const maxMonths = body.maxMonths ?? 3

  try {
    const result = await applyHanatourFullSyncToProduct(prisma, productId, detailUrl, {
      maxMonths,
    })
    return NextResponse.json({ ok: true, productId, departureMeta: result.departureMeta })
  } catch (e) {
    console.error('[hanatour full-sync]', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
