import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * GET /api/admin/products/[id]/prices. 인증: 관리자.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id } = await params
    const productId = id && typeof id === 'string' ? id : ''
    if (!productId) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const { searchParams } = new URL(request.url)
    const targetStr = searchParams.get('targetDate')?.trim()
    const targetDate = targetStr ? new Date(targetStr) : new Date()
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid targetDate' }, { status: 400 })
    }
    const start = new Date(targetDate)
    start.setDate(start.getDate() - 30)
    start.setHours(0, 0, 0, 0)
    const end = new Date(targetDate)
    end.setDate(end.getDate() + 30)
    end.setHours(23, 59, 59, 999)

    const prices = await prisma.productPrice.findMany({
      where: {
        productId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        adult: true,
        priceGap: true,
        childBed: true,
        childNoBed: true,
        infant: true,
      },
    })

    const rows = prices.map((p) => {
      const d = p.date instanceof Date ? p.date : new Date(p.date)
      return {
        date: d.toISOString().slice(0, 10),
        priceAdult: p.adult,
        priceGap: p.priceGap ?? null,
        status: null,
        priceChildWithBed: p.childBed ?? null,
        priceChildNoBed: p.childNoBed ?? null,
        priceInfant: p.infant ?? null,
      }
    })

    return NextResponse.json({ prices: rows })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
