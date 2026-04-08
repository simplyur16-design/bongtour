import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * GET /api/admin/photo-pool. 인증: 관리자.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const city = searchParams.get('city')?.trim()

    const list = await prisma.photoPool.findMany({
      where: city ? { cityName: city } : undefined,
      orderBy: [{ cityName: 'asc' }, { sortOrder: 'asc' }],
    })
    return NextResponse.json(list)
  } catch (e) {
    console.error('photo-pool GET:', e)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
}
