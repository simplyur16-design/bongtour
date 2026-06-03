import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { listTestIntakeCandidates, purgeAllTestIntakes } from '@/lib/purge-test-intake'

/**
 * GET — 테스트 접수 후보 목록
 * POST — 일괄 삭제 (body: { "dryRun": true } 미리보기)
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const candidates = await listTestIntakeCandidates()
  return NextResponse.json({
    ok: true,
    count: candidates.length,
    candidates,
  })
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let dryRun = false
  try {
    const body = (await request.json()) as { dryRun?: boolean }
    dryRun = body?.dryRun === true
  } catch {
    dryRun = false
  }

  try {
    const r = await purgeAllTestIntakes(dryRun)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    console.error('[POST /api/admin/intake/purge-test]', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    )
  }
}
