import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { BongContentStatus } from '@prisma/client'
import { parseContentStatus, readJsonBody } from '../../../shared'

const noteSelect = {
  id: true,
  bongSpotId: true,
  month: true,
  title: true,
  body: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id: bongSpotId } = await context.params
  const exists = await prisma.bongSpot.findUnique({ where: { id: bongSpotId }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: '스팟을 찾을 수 없습니다.' }, { status: 404 })

  try {
    const items = await prisma.bongSeasonalNote.findMany({
      where: { bongSpotId },
      select: noteSelect,
      orderBy: { month: 'asc' },
    })
    return NextResponse.json({ items })
  } catch (e) {
    console.error('[seasonal-notes GET]', e)
    return NextResponse.json({ error: '조회에 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id: bongSpotId } = await context.params
  const spot = await prisma.bongSpot.findUnique({ where: { id: bongSpotId }, select: { id: true } })
  if (!spot) return NextResponse.json({ error: '스팟을 찾을 수 없습니다.' }, { status: 404 })

  const body = await readJsonBody(request)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }
  const b = body as Record<string, unknown>
  const month = typeof b.month === 'number' ? b.month : parseInt(String(b.month ?? ''), 10)
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'month는 1~12 정수여야 합니다.' }, { status: 400 })
  }

  const existing = await prisma.bongSeasonalNote.findUnique({
    where: { bongSpotId_month: { bongSpotId, month } },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: '해당 월 노트가 이미 있습니다.' }, { status: 409 })
  }

  const status = parseContentStatus(b.status) ?? 'draft'

  try {
    const row = await prisma.bongSeasonalNote.create({
      data: {
        bongSpotId,
        month,
        title: typeof b.title === 'string' ? b.title : null,
        body: typeof b.body === 'string' ? b.body : null,
        status: status as BongContentStatus,
      },
      select: noteSelect,
    })
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error('[seasonal-notes POST]', e)
    return NextResponse.json({ error: '생성에 실패했습니다.' }, { status: 500 })
  }
}
