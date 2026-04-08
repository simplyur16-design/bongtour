import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { adminRejectReview } from '@/lib/reviews-db'

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

/** POST /api/admin/reviews/[id]/reject  body: { rejection_reason: string } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '관리자만 접근할 수 있습니다.' }, { status: 403 })
  }

  const { id } = await params
  if (!id || !isUuid(id)) {
    return NextResponse.json({ ok: false, error: '유효하지 않은 id' }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }
  const reason =
    json && typeof json === 'object' && json !== null && 'rejection_reason' in json
      ? String((json as { rejection_reason?: unknown }).rejection_reason ?? '')
      : ''

  const result = await adminRejectReview(id, reason)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
