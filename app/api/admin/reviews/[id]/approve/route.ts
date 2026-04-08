import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { adminApproveReview } from '@/lib/reviews-db'

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

/** POST /api/admin/reviews/[id]/approve  body: { displayed_date?: string } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '관리자만 접근할 수 있습니다.' }, { status: 403 })
  }

  const { id } = await params
  if (!id || !isUuid(id)) {
    return NextResponse.json({ ok: false, error: '유효하지 않은 id' }, { status: 400 })
  }

  let displayed_date: string | null | undefined
  try {
    const body = await request.json().catch(() => ({}))
    if (body && typeof body === 'object' && 'displayed_date' in body) {
      const v = (body as { displayed_date?: unknown }).displayed_date
      displayed_date = v == null || v === '' ? null : String(v).trim().slice(0, 10)
    }
  } catch {
    /* empty body ok */
  }

  const adminId = admin.user?.id ?? 'admin'
  const result = await adminApproveReview(id, adminId, { displayed_date })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
