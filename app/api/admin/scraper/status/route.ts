import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import * as logStream from '@/lib/admin-log-stream'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/scraper/status. 인증: 관리자.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const productId = logStream.getCurrentProductId()
    let currentOriginCode: string | null = null
    if (productId) {
      const p = await prisma.product.findUnique({
        where: { id: productId },
        select: { originCode: true },
      })
      currentOriginCode = p?.originCode ?? null
    }
    return NextResponse.json({
      currentProductId: productId,
      currentOriginCode,
    })
  } catch (e) {
    console.error('scraper/status:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
