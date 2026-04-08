import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getSchedulerConfig, setSchedulerConfig, type SchedulerConfig } from '@/lib/scheduler-config'

/**
 * GET /api/admin/scheduler/config. 인증: 관리자.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const config = getSchedulerConfig()
    return NextResponse.json(config)
  } catch (e) {
    console.error('scheduler config GET:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/scheduler/config. 인증: 관리자.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = (await req.json()) as Partial<SchedulerConfig>
    const config = setSchedulerConfig(body)
    return NextResponse.json(config)
  } catch (e) {
    console.error('scheduler config PATCH:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
