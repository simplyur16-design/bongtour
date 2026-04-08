import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalScheduleDayImageUrl } from '@/lib/final-image-selection'

const ONE_HOUR_MS = 60 * 60 * 1000
const MAX_PER_RUN = 10

/** schedule JSON에서 이미지 미보유 여부: 항목 중 하나라도 imageUrl 없으면 true */
function scheduleNeedsImages(schedule: string | null): boolean {
  if (!schedule || typeof schedule !== 'string') return false
  const rows = getScheduleFromProduct({ schedule })
  if (rows.length === 0) return false
  return rows.some((row) => !getFinalScheduleDayImageUrl(row))
}

/**
 * GET /api/admin/process-images/recent. 인증: 관리자.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const since = new Date(Date.now() - ONE_HOUR_MS)
    const products = await prisma.product.findMany({
      where: {
        updatedAt: { gte: since },
        schedule: { not: null },
      },
      select: { id: true, schedule: true, bgImageUrl: true },
      orderBy: { updatedAt: 'desc' },
      take: MAX_PER_RUN * 2,
    })

    const needImages = products.filter(
      (p) => !p.bgImageUrl || scheduleNeedsImages(p.schedule)
    )
    const toProcess = needImages.slice(0, MAX_PER_RUN)
    if (toProcess.length === 0) {
      return NextResponse.json({
        ok: true,
        message: '최근 1시간 이내 이미지 미생성 상품 없음',
        processed: 0,
      })
    }

    const forwarded =
      req.headers.get('x-forwarded-proto') && req.headers.get('host')
        ? `${req.headers.get('x-forwarded-proto')}://${req.headers.get('host')}`
        : null
    const base =
      process.env.BONGTOUR_API_BASE?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      process.env.NEXTAUTH_URL?.trim() ||
      forwarded ||
      'http://localhost:3000'
    const origin = base.replace(/\/$/, '')

    const results: { productId: string; success: boolean; error?: string }[] = []
    for (const p of toProcess) {
      try {
        const res = await fetch(`${origin}/api/travel/process-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: p.id }),
        })
        const text = await res.text()
        const data = text ? (JSON.parse(text) as { success?: boolean; error?: string }) : {}
        results.push({
          productId: p.id,
          success: res.ok && !!data.success,
          error: data.error,
        })
      } catch (e) {
        results.push({
          productId: p.id,
          success: false,
          error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        })
      }
    }

    const processed = results.filter((r) => r.success).length
    return NextResponse.json({
      ok: true,
      message: `최근 1시간 이내 상품 ${toProcess.length}건 중 ${processed}건 이미지 생성 완료`,
      processed,
      results,
    })
  } catch (e) {
    console.error('process-images/recent:', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
