import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { BongContentStatus } from '@prisma/client'
import { parseContentStatus, readJsonBody } from '../../shared'

const tipSelect = {
  id: true,
  title: true,
  body: true,
  tipKind: true,
  country: true,
  city: true,
  countryKey: true,
  cityKey: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id } = await context.params
  try {
    const row = await prisma.bongTip.findUnique({ where: { id }, select: tipSelect })
    if (!row) return NextResponse.json({ error: '찾을 수 없습니다.' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e) {
    console.error('[bong-tips/[id] GET]', e)
    return NextResponse.json({ error: '조회에 실패했습니다.' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id } = await context.params
  const body = await readJsonBody(request)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }
  const b = body as Record<string, unknown>
  const data: Record<string, unknown> = {}
  if (typeof b.title === 'string') data.title = b.title.trim()
  if ('body' in b) data.body = typeof b.body === 'string' ? b.body : null
  if ('tipKind' in b) data.tipKind = typeof b.tipKind === 'string' ? b.tipKind : null
  if ('country' in b) data.country = typeof b.country === 'string' ? b.country : null
  if ('city' in b) data.city = typeof b.city === 'string' ? b.city : null
  if ('countryKey' in b) data.countryKey = typeof b.countryKey === 'string' ? b.countryKey : null
  if ('cityKey' in b) data.cityKey = typeof b.cityKey === 'string' ? b.cityKey : null
  if ('status' in b) {
    const st = parseContentStatus(b.status)
    if (st) data.status = st
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '변경할 필드가 없습니다.' }, { status: 400 })
  }

  try {
    const row = await prisma.bongTip.update({
      where: { id },
      data: data as {
        title?: string
        body?: string | null
        tipKind?: string | null
        country?: string | null
        city?: string | null
        countryKey?: string | null
        cityKey?: string | null
        status?: BongContentStatus
      },
      select: tipSelect,
    })
    return NextResponse.json(row)
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: '찾을 수 없습니다.' }, { status: 404 })
    console.error('[bong-tips/[id] PATCH]', e)
    return NextResponse.json({ error: '수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id } = await context.params
  try {
    await prisma.bongTip.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: '찾을 수 없습니다.' }, { status: 404 })
    console.error('[bong-tips/[id] DELETE]', e)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }
}
