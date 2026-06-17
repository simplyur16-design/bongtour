import { NextResponse } from 'next/server'
import { generateCardNewsSeries } from '@/lib/bong-marketing/card-news-generator'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/** 카드뉴스 생성은 Pro 호출 + 편 수만큼 순차 → 충분한 타임아웃 확보 */
export const maxDuration = 300

/**
 * POST /api/admin/marketing/card-news/series/:id/generate
 * 시리즈 내 모든 편의 카피를 Gemini 로 자동 생성(운영자 수동 트리거).
 */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const series = await prisma.bongCardNewsSeries.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  // 생성 중 상태로
  await prisma.bongCardNewsSeries.update({
    where: { id },
    data: { status: 'generating' },
  })

  try {
    const results = await generateCardNewsSeries(id)
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    // 실패 시 draft 로 롤백
    await prisma.bongCardNewsSeries.update({
      where: { id },
      data: { status: 'draft' },
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
