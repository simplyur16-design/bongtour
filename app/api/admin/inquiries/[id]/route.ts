import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { INQUIRY_ADMIN_STATUSES, isInquiryAdminStatus } from '@/lib/admin-inquiry'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/inquiries/[id]
 * Body: { "status": "<InquiryAdminStatus>" }
 * - 허용되지 않은 status: 400
 * - 존재하지 않는 id: 404
 * - 인증 실패: 401
 */
export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { id } = await context.params
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '본문 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const statusRaw = (body as Record<string, unknown>).status
  if (typeof statusRaw !== 'string' || !isInquiryAdminStatus(statusRaw)) {
    return NextResponse.json(
      {
        error: '유효하지 않은 status입니다.',
        allowed: [...INQUIRY_ADMIN_STATUSES],
      },
      { status: 400 }
    )
  }

  try {
    const existing = await prisma.customerInquiry.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 })
    }

    const updated = await prisma.customerInquiry.update({
      where: { id },
      data: { status: statusRaw },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      ok: true,
      inquiry: {
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('[PATCH /api/admin/inquiries/[id]]', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
