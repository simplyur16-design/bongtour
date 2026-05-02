import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { parseMonthlyContentInput } from '@/lib/overseas-content-cms'

export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope')?.trim() || 'overseas'
  const monthKey = searchParams.get('monthKey')?.trim()

  const items = await prisma.monthlyCurationContent.findMany({
    where: {
      pageScope: scope,
      ...(monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? { monthKey } : {}),
    },
    orderBy: [{ monthKey: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

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

  const item = await prisma.monthlyCurationContent.create({ data: parsed.data })
  return NextResponse.json({ item }, { status: 201 })
}

