import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { adminFeatureReview } from '@/lib/reviews-db'

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

/** POST /api/admin/reviews/[id]/feature  body: { is_featured?: boolean, display_order?: number } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '관리자만 접근할 수 있습니다.' }, { status: 403 })
  }

  const { id } = await params
  if (!id || !isUuid(id)) {
    return NextResponse.json({ ok: false, error: '유효하지 않은 id' }, { status: 400 })
  }

  let json: Record<string, unknown> = {}
  try {
    const b = await request.json()
    if (b && typeof b === 'object' && !Array.isArray(b)) json = b as Record<string, unknown>
  } catch {
    /* empty */
  }

  const is_featured = typeof json.is_featured === 'boolean' ? json.is_featured : undefined
  const display_order = typeof json.display_order === 'number' ? json.display_order : undefined

  const result = await adminFeatureReview(id, { is_featured, display_order })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
