import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { refreshCurationEvents } from '@/lib/bong-marketing/curation-event-collector'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** POST /api/admin/marketing/global-events/refresh — CurationEvent 수동 갱신 (URL 호환) */
export async function POST() {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  try {
    const result = await refreshCurationEvents()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}
