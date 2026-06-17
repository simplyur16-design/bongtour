import { NextResponse } from 'next/server'
import { isoWeekKey } from '@/lib/bong-marketing/card-news-admin-constants'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

const SEASON_KOR: Record<string, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
}

const VALID_SEASONS = ['spring', 'summer', 'autumn', 'winter', 'all_year'] as const

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * POST /api/admin/marketing/card-news/series/from-recommendation
 * 시즌 추천 카드 → 카드뉴스 시리즈 + 1편(package/deep) 자동 생성
 */
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const city = typeof body.city === 'string' ? body.city.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''
  const season =
    typeof body.season === 'string' && (VALID_SEASONS as readonly string[]).includes(body.season)
      ? body.season
      : null
  const monthRange = typeof body.monthRange === 'string' ? body.monthRange.trim() : ''
  const urgency = typeof body.urgency === 'string' ? body.urgency.trim() : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  if (!city) return NextResponse.json({ error: 'city 필수' }, { status: 400 })
  if (!season) return NextResponse.json({ error: 'season 필수' }, { status: 400 })

  const tripNights =
    typeof body.recommendedTripNights === 'number' && body.recommendedTripNights > 0
      ? Math.floor(body.recommendedTripNights)
      : 4
  const tripDays =
    typeof body.recommendedTripDays === 'number' && body.recommendedTripDays > 0
      ? Math.floor(body.recommendedTripDays)
      : 5

  const matchingProductIds = Array.isArray(body.matchingProductIds)
    ? body.matchingProductIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []

  let firstProductId: string | null = matchingProductIds[0] ?? null
  if (firstProductId) {
    const product = await prisma.product.findUnique({ where: { id: firstProductId }, select: { id: true } })
    if (!product) firstProductId = null
  }

  const themeTitle = `${SEASON_KOR[season] ?? season} ${city}`
  const operatorNote = [
    '[자동 생성]',
    [monthRange, urgency].filter(Boolean).join(' · '),
    reason,
    country ? `국가: ${country}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const series = await prisma.bongCardNewsSeries.create({
    data: {
      weekKey: isoWeekKey(),
      themeTitle,
      selectedCities: [city],
      tripNights,
      tripDays,
      season,
      operatorNote,
      status: 'draft',
    },
  })

  await prisma.bongCardNewsEpisode.create({
    data: {
      seriesId: series.id,
      episodeNumber: 1,
      episodeType: 'package',
      formatType: 'deep',
      title: `${city} 추천 여행`,
      targetCity: city,
      linkedProductId: firstProductId,
      operatorNote: '[자동 생성] 추천 결과 기반 1편',
      status: 'draft',
    },
  })

  return NextResponse.json({
    seriesId: series.id,
    redirectTo: `/admin/marketing/card-news/${series.id}`,
  })
}
