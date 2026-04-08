import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { parseMonthlyContentInput } from '@/lib/overseas-content-cms'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  const item = await prisma.monthlyCurationContent.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ item })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

  const existing = await prisma.monthlyCurationContent.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }
  const parsed = parseMonthlyContentInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: '입력값을 확인해 주세요.', fieldErrors: parsed.errors }, { status: 400 })
  }

  const item = await prisma.monthlyCurationContent.update({
    where: { id },
    data: parsed.data,
  })
  return NextResponse.json({ item })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  await prisma.monthlyCurationContent.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

