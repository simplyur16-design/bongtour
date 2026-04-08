import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { activateHomeHubCandidate } from '@/lib/home-hub-candidates'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { candidateId?: string }
  const candidateId = typeof body.candidateId === 'string' ? body.candidateId.trim() : ''
  if (!candidateId) {
    return NextResponse.json({ ok: false, error: 'candidateId가 필요합니다.' }, { status: 400 })
  }

  const updatedBy =
    (admin.user as { email?: string | null }).email?.trim() ||
    admin.user.id ||
    'admin'

  try {
    const { candidate, active } = activateHomeHubCandidate(candidateId, { updatedBy })
    return NextResponse.json({ ok: true, candidate, active })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    const status = msg.includes('찾을 수 없') ? 404 : 500
    return NextResponse.json(
      { ok: false, error: status === 404 ? '대상을 찾을 수 없습니다.' : '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status }
    )
  }
}
