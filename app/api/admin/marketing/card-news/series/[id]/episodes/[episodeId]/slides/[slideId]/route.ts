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

/** PATCH — 슬라이드 headline, subtitle, body, pexelsKeyword 수정 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; episodeId: string; slideId: string }> },
) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id: seriesId, episodeId, slideId } = await context.params
  const slide = await prisma.bongCardNewsSlide.findFirst({
    where: {
      id: slideId,
      episode: { id: episodeId, seriesId },
    },
    select: { id: true },
  })
  if (!slide) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const data: Prisma.BongCardNewsSlideUpdateInput = {}
  if (typeof body.headline === 'string') {
    const headline = body.headline.trim()
    if (!headline) return NextResponse.json({ error: 'headline 비어 있음' }, { status: 400 })
    data.headline = headline
  }
  if (body.subtitle === null || typeof body.subtitle === 'string') {
    data.subtitle = body.subtitle === null ? null : body.subtitle.trim() || null
  }
  if (typeof body.body === 'string' || body.body === null) {
    data.body = body.body === null ? null : body.body.trim() || null
  }
  if (typeof body.pexelsKeyword === 'string' || body.pexelsKeyword === null) {
    data.pexelsKeyword = body.pexelsKeyword === null ? null : body.pexelsKeyword.trim() || null
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'headline, subtitle, body 또는 pexelsKeyword 필요' }, { status: 400 })
  }
  data.status = 'edited'

  const updated = await prisma.bongCardNewsSlide.update({ where: { id: slideId }, data })
  return NextResponse.json({ slide: updated })
}
