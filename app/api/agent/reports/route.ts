import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * GET /api/agent/reports
 * 미해결 경로 이탈 보고서 목록 (사장님 대시보드용)
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  const list = await prisma.agentScrapeReport.findMany({
    where: { resolved: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return NextResponse.json(list)
}
