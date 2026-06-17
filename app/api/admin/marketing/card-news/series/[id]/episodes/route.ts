import { NextResponse } from 'next/server'
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

/** GET /api/admin/marketing/card-news/series/:id/episodes — 편 목록 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const episodes = await prisma.bongCardNewsEpisode.findMany({
    where: { seriesId: id },
    orderBy: { episodeNumber: 'asc' },
    include: {
      slides: { orderBy: { slideNumber: 'asc' } },
      linkedProduct: { select: { id: true, title: true, country: true, city: true } },
    },
  })
  return NextResponse.json({ episodes })
}

/** POST /api/admin/marketing/card-news/series/:id/episodes — 편 추가(운영자 수동, Deep/List 토글) */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id: seriesId } = await context.params
  const series = await prisma.bongCardNewsSeries.findUnique({
    where: { id: seriesId },
    select: { id: true },
  })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'title 필수' }, { status: 400 })

  const episodeType =
    typeof body.episodeType === 'string' && (EPISODE_TYPES as readonly string[]).includes(body.episodeType)
      ? body.episodeType
      : 'package'
  const formatType =
    typeof body.formatType === 'string' && (FORMAT_TYPES as readonly string[]).includes(body.formatType)
      ? body.formatType
      : 'deep'

  // linkedProductId 유효성(있으면 존재 확인)
  let linkedProductId: string | null = null
  if (typeof body.linkedProductId === 'string' && body.linkedProductId.trim()) {
    const candidate = body.linkedProductId.trim()
    const product = await prisma.product.findUnique({ where: { id: candidate }, select: { id: true } })
    if (!product) {
      return NextResponse.json({ error: 'linkedProductId 상품을 찾을 수 없습니다.' }, { status: 400 })
    }
    linkedProductId = candidate
  }

  // episodeNumber: 명시값 없으면 max + 1
  let episodeNumber: number
  if (typeof body.episodeNumber === 'number' && Number.isInteger(body.episodeNumber) && body.episodeNumber >= 1) {
    episodeNumber = body.episodeNumber
  } else {
    const last = await prisma.bongCardNewsEpisode.findFirst({
      where: { seriesId },
      orderBy: { episodeNumber: 'desc' },
      select: { episodeNumber: true },
    })
    episodeNumber = (last?.episodeNumber ?? 0) + 1
  }

  try {
    const episode = await prisma.bongCardNewsEpisode.create({
      data: {
        seriesId,
        episodeNumber,
        episodeType,
        formatType,
        title,
        linkedProductId,
        targetCity: typeof body.targetCity === 'string' ? body.targetCity.trim() || null : null,
        targetPlace: typeof body.targetPlace === 'string' ? body.targetPlace.trim() || null : null,
        operatorNote: typeof body.operatorNote === 'string' ? body.operatorNote.trim() || null : null,
      },
    })
    return NextResponse.json({ episode }, { status: 201 })
  } catch (e) {
    // unique([seriesId, episodeNumber]) 충돌 등
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `편 생성 실패: ${msg}` }, { status: 400 })
  }
}
