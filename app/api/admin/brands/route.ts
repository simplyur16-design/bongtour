import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * GET /api/admin/brands. 인증: 관리자.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(brands)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/brands. 인증: 관리자.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = await request.json() as {
      brandKey: string
      displayName: string
      logoPath?: string | null
      primaryColor?: string | null
      sortOrder?: number
    }
    const { brandKey, displayName } = body
    if (!brandKey?.trim() || !displayName?.trim()) {
      return NextResponse.json(
        { error: 'brandKey, displayName 필수' },
        { status: 400 }
      )
    }
    const created = await prisma.brand.create({
      data: {
        brandKey: brandKey.trim(),
        displayName: displayName.trim(),
        logoPath: body.logoPath?.trim() || null,
        primaryColor: body.primaryColor?.trim() || null,
        sortOrder: body.sortOrder ?? 999,
      },
    })
    return NextResponse.json(created)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
