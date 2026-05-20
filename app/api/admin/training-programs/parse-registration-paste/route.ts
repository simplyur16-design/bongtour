import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { parseTrainingRegistrationPaste } from '@/lib/overseas-training-registration-paste'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const pasted = typeof body.pastedText === 'string' ? body.pastedText.trim() : ''
  if (!pasted) {
    return NextResponse.json({ ok: false, error: 'pastedText가 필요합니다.' }, { status: 400 })
  }

  const draft = parseTrainingRegistrationPaste(pasted)
  return NextResponse.json({ ok: true, draft })
}
