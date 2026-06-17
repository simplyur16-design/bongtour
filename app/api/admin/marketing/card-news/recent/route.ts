import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { seasonLabel } from '@/lib/bong-marketing/card-news-admin-constants'

/** GET /api/admin/marketing/card-news/recent */
export async function GET() {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const rows = await prisma.bongCardNewsSeries.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      _count: { select: { episodes: true } },
    },
  })

  const series = rows.map((s) => ({
    id: s.id,
    themeTitle: s.themeTitle,
    selectedCities: s.selectedCities,
    season: s.season,
    seasonLabel: seasonLabel(s.season),
    tripNights: s.tripNights,
    tripDays: s.tripDays,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    episodeCount: s._count.episodes,
  }))

  return NextResponse.json({ series })
}
