import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateEpisodeCaption } from '@/lib/bong-marketing/episode-caption-generator'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 120

/**
 * POST /api/admin/marketing/card-news/episodes/:id/caption
 */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id: episodeId } = await context.params
  const episode = await prisma.bongCardNewsEpisode.findUnique({
    where: { id: episodeId },
    include: {
      series: true,
      linkedProduct: { select: { title: true, country: true, city: true } },
      slides: { orderBy: { slideNumber: 'asc' }, select: { headline: true } },
    },
  })

  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!episode.slides.length) {
    return NextResponse.json({ error: '슬라이드가 없습니다. 먼저 카피를 생성하세요.' }, { status: 400 })
  }

  const city = episode.targetCity ?? episode.series.selectedCities[0] ?? ''
  const country =
    episode.linkedProduct?.country ?? episode.series.selectedCities[0] ?? city ?? '여행'

  try {
    const result = await generateEpisodeCaption({
      episodeType: episode.episodeType as 'package' | 'tip' | 'caution',
      city,
      country,
      season: episode.series.season ?? undefined,
      slideHighlights: episode.slides.map((s) => s.headline),
      productName: episode.linkedProduct?.title,
    })

    const updated = await prisma.bongCardNewsEpisode.update({
      where: { id: episodeId },
      data: {
        caption: result.caption,
        hashtags: result.hashtags,
      },
    })

    return NextResponse.json({
      caption: result.caption,
      hashtags: result.hashtags,
      episode: updated,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '캡션 생성 실패' },
      { status: 500 },
    )
  }
}
