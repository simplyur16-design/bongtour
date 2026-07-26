import { NextResponse } from 'next/server'
import { requireAffiliationReviewer } from '@/lib/require-admin'
import { reviewAffiliationCardRequest } from '@/lib/bongsim/affiliation/affiliation-card-service'

export const dynamic = 'force-dynamic'

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

/** POST /api/admin/affiliation-cards/[id]/review  body: { decision: 'approve'|'reject', adminNote?: string } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAffiliationReviewer()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '관리자·스태프만 접근할 수 있습니다.' }, { status: 403 })
  }

  const { id } = await params
  if (!id || !isUuid(id)) {
    return NextResponse.json({ ok: false, error: '유효하지 않은 id' }, { status: 400 })
  }

  let decision: 'approve' | 'reject' | null = null
  let adminNote: string | null = null
  try {
    const body = (await request.json().catch(() => ({}))) as {
      decision?: unknown
      adminNote?: unknown
    }
    const d = String(body.decision ?? '').trim()
    if (d === 'approve' || d === 'reject') decision = d
    if (typeof body.adminNote === 'string') adminNote = body.adminNote
  } catch {
    /* empty */
  }

  if (!decision) {
    return NextResponse.json({ ok: false, error: 'decision=approve|reject 필요' }, { status: 400 })
  }

  const result = await reviewAffiliationCardRequest({
    requestId: id,
    decision,
    adminUserId: admin.user?.id ?? 'admin',
    adminNote,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, status: result.status })
}
