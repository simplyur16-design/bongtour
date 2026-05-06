import { NextResponse } from 'next/server'
import { formatMasterIntegritySms, runMasterIntegrityCheck } from '@/lib/master-integrity'
import { runMasterIntegrityScheduledJob } from '@/lib/master-integrity-job'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

/** GET: 리포트만 (알림 없음) */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const report = await runMasterIntegrityCheck(prisma)
    return NextResponse.json(report)
  } catch (e) {
    console.error('[master-integrity GET]', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/**
 * POST: 검증 + 이상 시 Solapi (dry-run은 `MASTER_INTEGRITY_ALERT_DRY_RUN`).
 * `?skipNotify=1` — 알림 생략.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const skipNotify = searchParams.get('skipNotify') === '1'
  try {
    const report = await runMasterIntegrityScheduledJob({ skipNotify })
    return NextResponse.json({
      ok: true,
      skipNotify,
      smsPreview: report.counts.brokenTotal > 0 ? formatMasterIntegritySms(report) : null,
      report,
    })
  } catch (e) {
    console.error('[master-integrity POST]', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
