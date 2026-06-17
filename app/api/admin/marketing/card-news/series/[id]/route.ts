import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
}

const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'all_year'] as const

function parsePositiveInt(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return null
  return v
}

/** GET /api/admin/marketing/card-news/series/:id — 시리즈 상세(편·슬라이드 포함) */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const series = await prisma.bongCardNewsSeries.findUnique({
    where: { id },
    include: {
      episodes: {
        orderBy: { episodeNumber: 'asc' },
        include: {
          slides: { orderBy: { slideNumber: 'asc' } },
          linkedProduct: { select: { id: true, title: true, country: true, city: true } },
        },
      },
    },
  })
  if (!series) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ series })
}

/** PATCH /api/admin/marketing/card-news/series/:id — 시리즈 수정 */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const data: Prisma.BongCardNewsSeriesUpdateInput = {}
  if (typeof body.themeTitle === 'string') data.themeTitle = body.themeTitle.trim()
  if (Array.isArray(body.selectedCities)) data.selectedCities = asStringArray(body.selectedCities)
  if (typeof body.operatorNote === 'string' || body.operatorNote === null) {
    data.operatorNote = body.operatorNote === null ? null : (body.operatorNote as string).trim() || null
  }
  if (typeof body.status === 'string') data.status = body.status.trim()
  if (typeof body.weekKey === 'string' && body.weekKey.trim()) data.weekKey = body.weekKey.trim()
  if (typeof body.tripNights === 'number') {
    const n = parsePositiveInt(body.tripNights)
    if (n === null) return NextResponse.json({ error: 'tripNights 정수 오류' }, { status: 400 })
    data.tripNights = n
  }
  if (typeof body.tripDays === 'number') {
    const n = parsePositiveInt(body.tripDays)
    if (n === null) return NextResponse.json({ error: 'tripDays 정수 오류' }, { status: 400 })
    data.tripDays = n
  }
  if (body.season === null) {
    data.season = null
  } else if (typeof body.season === 'string') {
    const s = body.season.trim()
    if (s && !(SEASONS as readonly string[]).includes(s)) {
      return NextResponse.json({ error: 'season 은 spring|summer|autumn|winter|all_year' }, { status: 400 })
    }
    data.season = s || null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '수정할 필드가 없습니다.' }, { status: 400 })
  }

  try {
    const updated = await prisma.bongCardNewsSeries.update({ where: { id }, data })
    return NextResponse.json({ series: updated })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

/** DELETE /api/admin/marketing/card-news/series/:id — 시리즈 삭제(편·슬라이드 cascade) */
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  try {
    await prisma.bongCardNewsSeries.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
