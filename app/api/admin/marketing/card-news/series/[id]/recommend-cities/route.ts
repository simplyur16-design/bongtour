import { NextResponse } from 'next/server'
import { recommendCities } from '@/lib/bong-marketing/city-recommender'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'all_year'] as const

/**
 * POST /api/admin/marketing/card-news/series/:id/recommend-cities
 * 시리즈 메타 기반 도시 자동 추천 → selectedCities 덮어쓰기
 */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const series = await prisma.bongCardNewsSeries.findUnique({ where: { id } })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  const operatorContext = await prisma.bongMarketingContext.findUnique({
    where: { weekKey: series.weekKey },
  })

  const season =
    series.season && (SEASONS as readonly string[]).includes(series.season) ? series.season : null

  try {
    const recommendation = await recommendCities({
      themeTitle: series.themeTitle,
      season,
      tripNights: series.tripNights,
      tripDays: series.tripDays,
      themeIntent: operatorContext?.themeIntent ?? undefined,
      customKeywords: operatorContext?.customKeywords ?? undefined,
    })

    const updated = await prisma.bongCardNewsSeries.update({
      where: { id },
      data: { selectedCities: recommendation.cities },
    })

    return NextResponse.json({
      series: updated,
      recommendation,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '도시 추천 실패' },
      { status: 500 },
    )
  }
}
