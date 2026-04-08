import { NextResponse } from 'next/server'
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'
import { getFeaturedOverseasReviews } from '@/lib/reviews-db'

/** GET /api/reviews/featured?limit=6 — 해외 published 대표 후기 전용 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitRaw = searchParams.get('limit')
  const limit = limitRaw ? Number(limitRaw) : 6
  const items = await getFeaturedOverseasReviews(Number.isFinite(limit) ? limit : 6)

  const payload = { ok: true, items }
  assertNoInternalMetaLeak(payload, 'GET /api/reviews/featured')
  return NextResponse.json(
    payload,
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    }
  )
}
