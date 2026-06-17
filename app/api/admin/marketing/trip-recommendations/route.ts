import { NextResponse } from 'next/server'
import { generateTripRecommendations } from '@/lib/bong-marketing/trip-recommender'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300

/**
 * POST /api/admin/marketing/trip-recommendations
 * 운영자 [추천 받기] 시에만 호출. 캐시 없음.
 */
export async function POST() {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  try {
    const result = await generateTripRecommendations()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '추천 생성 실패' },
      { status: 500 },
    )
  }
}
