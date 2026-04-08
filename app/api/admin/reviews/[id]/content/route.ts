import { NextResponse } from 'next/server'
import { adminUpdateReviewContent } from '@/lib/reviews-db'
import { requireAdmin } from '@/lib/require-admin'

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

/** PATCH /api/admin/reviews/[id]/content  body: { title?, excerpt?, body? | null } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ ok: false, error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  const patch: { title?: string; excerpt?: string; body?: string | null } = {}
  if (typeof json.title === 'string') patch.title = json.title
  if (typeof json.excerpt === 'string') patch.excerpt = json.excerpt
  if (json.body === null) patch.body = null
  else if (typeof json.body === 'string') patch.body = json.body

  const result = await adminUpdateReviewContent(id, patch)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
