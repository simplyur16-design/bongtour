import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

const EPISODE_TYPES = ['package', 'tip', 'caution'] as const
const FORMAT_TYPES = ['deep', 'list'] as const

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** GET /api/admin/marketing/card-news/series/:id/episodes/:episodeId — 편 상세 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string; episodeId: string }> },
) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id: seriesId, episodeId } = await context.params
  const episode = await prisma.bongCardNewsEpisode.findFirst({
    where: { id: episodeId, seriesId },
    include: {
      slides: { orderBy: { slideNumber: 'asc' } },
      linkedProduct: { select: { id: true, title: true, country: true, city: true } },
    },
  })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ episode })
}

/** PATCH — 편 수정(episodeType/formatType 토글, title, linkedProductId, targetCity/Place, operatorNote, status) */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; episodeId: string }> },
) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id: seriesId, episodeId } = await context.params
  const existing = await prisma.bongCardNewsEpisode.findFirst({
    where: { id: episodeId, seriesId },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const data: Prisma.BongCardNewsEpisodeUpdateInput = {}

  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.episodeType === 'string') {
    if (!(EPISODE_TYPES as readonly string[]).includes(body.episodeType)) {
      return NextResponse.json({ error: 'episodeType 은 package|tip|caution' }, { status: 400 })
    }
    data.episodeType = body.episodeType
  }
  if (typeof body.formatType === 'string') {
    if (!(FORMAT_TYPES as readonly string[]).includes(body.formatType)) {
      return NextResponse.json({ error: 'formatType 은 deep|list' }, { status: 400 })
    }
    data.formatType = body.formatType
  }
  if (typeof body.targetCity === 'string' || body.targetCity === null) {
    data.targetCity = body.targetCity === null ? null : (body.targetCity as string).trim() || null
  }
  if (typeof body.targetPlace === 'string' || body.targetPlace === null) {
    data.targetPlace = body.targetPlace === null ? null : (body.targetPlace as string).trim() || null
  }
  if (typeof body.operatorNote === 'string' || body.operatorNote === null) {
    data.operatorNote = body.operatorNote === null ? null : (body.operatorNote as string).trim() || null
  }
  if (typeof body.status === 'string' && body.status.trim()) data.status = body.status.trim()

  // linkedProductId: null 로 연결 해제 가능, 문자열이면 존재 확인
  if (body.linkedProductId === null) {
    data.linkedProduct = { disconnect: true }
  } else if (typeof body.linkedProductId === 'string' && body.linkedProductId.trim()) {
    const candidate = body.linkedProductId.trim()
    const product = await prisma.product.findUnique({ where: { id: candidate }, select: { id: true } })
    if (!product) {
      return NextResponse.json({ error: 'linkedProductId 상품을 찾을 수 없습니다.' }, { status: 400 })
    }
    data.linkedProduct = { connect: { id: candidate } }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '수정할 필드가 없습니다.' }, { status: 400 })
  }

  const updated = await prisma.bongCardNewsEpisode.update({ where: { id: episodeId }, data })
  return NextResponse.json({ episode: updated })
}

/** DELETE — 편 삭제(슬라이드 cascade) */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string; episodeId: string }> },
) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id: seriesId, episodeId } = await context.params
  const existing = await prisma.bongCardNewsEpisode.findFirst({
    where: { id: episodeId, seriesId },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.bongCardNewsEpisode.delete({ where: { id: episodeId } })
  return NextResponse.json({ ok: true })
}
