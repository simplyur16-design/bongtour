import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * GET /api/admin/stats/today
 * 오늘(KST 기준) 수집 성공/실패 상품 수.
 * - success: 오늘 updatedAt 인 Product 수
 * - fail: 오늘 생성된 AgentScrapeReport 수
 */
function startOfTodayKst(): Date {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth()
  const d = kst.getUTCDate()
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - 9 * 60 * 60 * 1000)
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const start = startOfTodayKst()
    const [success, fail] = await Promise.all([
      prisma.product.count({ where: { updatedAt: { gte: start } } }),
      prisma.agentScrapeReport.count({ where: { createdAt: { gte: start } } }),
    ])
    return NextResponse.json({ success, fail })
  } catch (e) {
    console.error('stats/today:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
