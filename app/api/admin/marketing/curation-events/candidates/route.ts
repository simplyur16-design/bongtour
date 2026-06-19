import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { listCandidateCurationEventsForCard } from '@/lib/bong-marketing/curation-event-card-link'

export const dynamic = 'force-dynamic'

/** GET /api/admin/marketing/curation-events/candidates?monthKey=&countryCode= */
export async function GET(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const monthKey = searchParams.get('monthKey')?.trim() ?? ''
  const countryCode = searchParams.get('countryCode')?.trim() || null

  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return NextResponse.json({ error: 'monthKey(YYYY-MM)가 필요합니다.' }, { status: 400 })
  }

  try {
    const events = await listCandidateCurationEventsForCard({ monthKey, countryCode })
    return NextResponse.json({ events, total: events.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}
