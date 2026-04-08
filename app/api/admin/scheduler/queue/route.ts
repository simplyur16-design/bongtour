import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * POST /api/admin/scheduler/queue. 인증: 관리자.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = (await req.json()) as { productIds?: string[] }
    const ids = Array.isArray(body?.productIds) ? body.productIds.filter((id) => typeof id === 'string') : []
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, added: 0, message: '추가할 상품이 없습니다.' })
    }

    const existing = await prisma.scraperQueue.findMany({
      where: { productId: { in: ids } },
      select: { productId: true },
    })
    const existingSet = new Set(existing.map((e) => e.productId))
    const toAdd = ids.filter((id) => !existingSet.has(id))
    if (toAdd.length === 0) {
      return NextResponse.json({ ok: true, added: 0, message: '이미 큐에 있는 상품만 있습니다.' })
    }

    await prisma.scraperQueue.createMany({
      data: toAdd.map((productId) => ({ productId })),
    })
    return NextResponse.json({
      ok: true,
      added: toAdd.length,
      message: `${toAdd.length}건 큐에 추가됨. 다음 봇 실행 시 우선 재수집됩니다.`,
    })
  } catch (e) {
    console.error('scheduler/queue POST:', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
