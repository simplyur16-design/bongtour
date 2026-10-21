import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { healAndGatePendingProductForOperator } from '@/lib/register-pre-photo-pending-open-heal'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/admin/products/[id]/pre-photo-heal
 * 등록대기 상세 — 라이브 검증 실패 시 셀프힐·레인 remat으로 통과까지.
 * REGRESSION-FREEZE[pending-open-self-heal-verify]: admin open heal — manifest
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

    const result = await healAndGatePendingProductForOperator(productId)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[admin/products/pre-photo-heal]', e)
    return NextResponse.json(
      { error: '셀프힐 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    )
  }
}
