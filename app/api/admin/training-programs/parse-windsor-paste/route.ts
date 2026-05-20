import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { parseWindsorTrainingPaste } from '@/lib/overseas-training-parse-windsor'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const pastedText = typeof body.pastedText === 'string' ? body.pastedText : ''
  const originUrl = typeof body.originUrl === 'string' ? body.originUrl : null

  if (pastedText.trim().length < 20) {
    return NextResponse.json({ ok: false, error: '붙여넣기 본문이 너무 짧습니다.' }, { status: 400 })
  }

  const draft = await parseWindsorTrainingPaste({ pastedText, originUrl })
  return NextResponse.json({ ok: true, draft })
}
