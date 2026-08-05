import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { parseMonthlyContentInput } from '@/lib/overseas-content-cms'
import { CURATION_EVENT_SUMMARY_SELECT } from '@/lib/bong-marketing/curation-event-card-link'

export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope')?.trim() || 'overseas'
  const monthKey = searchParams.get('monthKey')?.trim()

  try {
    const items = await prisma.monthlyCurationContent.findMany({
      where: {
        pageScope: scope,
        ...(monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? { monthKey } : {}),
      },
      orderBy: [{ monthKey: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
      include: {
        curationEvents: {
          select: CURATION_EVENT_SUMMARY_SELECT,
          orderBy: { name: 'asc' },
        },
      },
    })
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/admin/monthly-curation-contents GET]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
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

