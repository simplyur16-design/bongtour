import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_TYPES = new Set(['festival', 'holiday', 'season', 'sale', 'special'])

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** PATCH /api/admin/marketing/curation-events/[id] — 운영자 수정 */
export async function PATCH(req: Request, context: RouteContext) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const existing = await prisma.curationEvent.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '이벤트를 찾을 수 없습니다.' }, { status: 404 })
  }

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const data: Record<string, unknown> = {}

  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.city === 'string') data.city = body.city.trim() || null
  if (typeof body.description === 'string') data.description = body.description.trim() || null
  if (typeof body.appealReason === 'string') data.appealReason = body.appealReason.trim() || null
  if (typeof body.type === 'string' && VALID_TYPES.has(body.type)) data.type = body.type

  const startMonth = body.startMonth
  const endMonth = body.endMonth
  if (typeof startMonth === 'number' && startMonth >= 1 && startMonth <= 12) {
    data.startMonth = startMonth
    data.monthKey = `${existing.year}-${String(startMonth).padStart(2, '0')}`
  }
  if (typeof endMonth === 'number' && endMonth >= 1 && endMonth <= 12) {
    data.endMonth = endMonth
  }
  if (typeof body.startDay === 'number') data.startDay = body.startDay
  if (typeof body.endDay === 'number') data.endDay = body.endDay

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: '수정할 필드가 없습니다.' }, { status: 400 })
  }

  const event = await prisma.curationEvent.update({
    where: { id },
    data,
  })

  return NextResponse.json({ event })
}
