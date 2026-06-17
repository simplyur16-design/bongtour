import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { runInsightSyncTick } from '@/lib/instrumentation-insight-sync-cron'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** POST /api/admin/marketing/insights/sync — 수동 인사이트 수집 + 후킹 학습 */
export async function POST() {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  try {
    const result = await runInsightSyncTick('manual')
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}
