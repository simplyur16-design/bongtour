import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { refreshGlobalEvents } from '@/lib/bong-marketing/global-event-collector'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** POST /api/admin/marketing/global-events/refresh — 글로벌 이벤트 수동 갱신 */
export async function POST() {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  try {
    const result = await refreshGlobalEvents()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}
