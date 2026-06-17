import { NextResponse } from 'next/server'
import {
  collectSeasonalEvents,
  invalidateSeasonalEventsCache,
} from '@/lib/bong-marketing/seasonal-event-collector'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300

/** POST /api/admin/marketing/seasonal-events/refresh */
export async function POST() {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  try {
    invalidateSeasonalEventsCache()
    const events = await collectSeasonalEvents()
    return NextResponse.json({ count: events.length, events })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '이벤트 갱신 실패' },
      { status: 500 },
    )
  }
}
