import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { BongContentStatus } from '@prisma/client'
import { parseContentStatus, readJsonBody } from '../../../../shared'

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

function parseMonthParam(raw: string): number | null {
  const m = parseInt(raw, 10)
  if (!Number.isInteger(m) || m < 1 || m > 12) return null
  return m
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; month: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id: bongSpotId, month: monthStr } = await context.params
  const month = parseMonthParam(monthStr)
  if (month == null) {
    return NextResponse.json({ error: 'month는 1~12여야 합니다.' }, { status: 400 })
  }

  const body = await readJsonBody(request)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }
  const b = body as Record<string, unknown>
  const data: Record<string, unknown> = {}
  if ('title' in b) data.title = typeof b.title === 'string' ? b.title : null
  if ('body' in b) data.body = typeof b.body === 'string' ? b.body : null
  if ('status' in b) {
    const st = parseContentStatus(b.status)
    if (st) data.status = st
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '변경할 필드가 없습니다.' }, { status: 400 })
  }

  try {
    const row = await prisma.bongSeasonalNote.update({
      where: { bongSpotId_month: { bongSpotId, month } },
      data: data as { title?: string | null; body?: string | null; status?: BongContentStatus },
      select: noteSelect,
    })
    return NextResponse.json(row)
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === 'P2025') {
      return NextResponse.json({ error: '해당 월 노트를 찾을 수 없습니다.' }, { status: 404 })
    }
    console.error('[seasonal-notes PATCH]', e)
    return NextResponse.json({ error: '수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; month: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id: bongSpotId, month: monthStr } = await context.params
  const month = parseMonthParam(monthStr)
  if (month == null) {
    return NextResponse.json({ error: 'month는 1~12여야 합니다.' }, { status: 400 })
  }

  try {
    await prisma.bongSeasonalNote.delete({
      where: { bongSpotId_month: { bongSpotId, month } },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === 'P2025') {
      return NextResponse.json({ error: '해당 월 노트를 찾을 수 없습니다.' }, { status: 404 })
    }
    console.error('[seasonal-notes DELETE]', e)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }
}
