import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createTrainingProgram, listTrainingProgramsAdmin } from '@/lib/overseas-training-admin'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  const programs = await listTrainingProgramsAdmin()
  return NextResponse.json({ ok: true, programs })
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await createTrainingProgram(body)
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 })
  }
  return NextResponse.json({ ok: true, product: result.product })
}
