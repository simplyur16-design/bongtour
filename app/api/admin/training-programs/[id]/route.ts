import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { trainingProgramAdminSelect, updateTrainingProgram } from '@/lib/overseas-training-admin'
import { prisma } from '@/lib/prisma'
import { OVERSEAS_TRAINING_LISTING_KIND } from '@/lib/overseas-training-program-query'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id } = await ctx.params
  const product = await prisma.product.findFirst({
    where: { id, listingKind: OVERSEAS_TRAINING_LISTING_KIND },
    select: trainingProgramAdminSelect,
  })
  if (!product) {
    return NextResponse.json({ ok: false, error: '없음' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, product })
}

export async function PATCH(request: Request, ctx: Ctx) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id } = await ctx.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await updateTrainingProgram(id, body)
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, errors: result.errors, error: result.errors[0] },
      { status: result.errors[0] === '프로그램을 찾을 수 없습니다.' ? 404 : 400 }
    )
  }
  return NextResponse.json({ ok: true, product: result.product })
}
