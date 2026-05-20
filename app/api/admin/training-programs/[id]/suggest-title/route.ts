import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { suggestBongtourTrainingProductTitle } from '@/lib/bongtour-training-product-title'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  await ctx.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const originalTitle = typeof body.originalTitle === 'string' ? body.originalTitle : ''
  const result = await suggestBongtourTrainingProductTitle({
    originalTitle,
    trainingCategory: typeof body.trainingCategory === 'string' ? body.trainingCategory : null,
    destinationSummary: typeof body.destinationSummary === 'string' ? body.destinationSummary : null,
    durationDays:
      typeof body.durationDays === 'number' && Number.isInteger(body.durationDays)
        ? body.durationDays
        : null,
  })
  if (!result.title) {
    return NextResponse.json({ ok: false, error: result.error ?? '제목 생성 실패' }, { status: 422 })
  }
  return NextResponse.json({ ok: true, title: result.title })
}
