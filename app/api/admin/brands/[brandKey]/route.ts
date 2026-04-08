import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

type RouteParams = { params: { brandKey: string } }

/**
 * PATCH /api/admin/brands/[brandKey]. 인증: 관리자.
 */
export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const brandKey = decodeURIComponent(params.brandKey)
    const body = await request.json() as {
      displayName?: string
      logoPath?: string | null
      primaryColor?: string | null
      disclaimerText?: string | null
      officialUrl?: string | null
      productUrlTemplate?: string | null
      defaultTerms?: string | null
      cancelFeeTerms?: string | null
      sortOrder?: number
    }

    const updated = await prisma.brand.update({
      where: { brandKey },
      data: {
        ...(body.displayName !== undefined && { displayName: body.displayName }),
        ...(body.logoPath !== undefined && { logoPath: body.logoPath }),
        ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
        ...(body.disclaimerText !== undefined && { disclaimerText: body.disclaimerText }),
        ...(body.officialUrl !== undefined && { officialUrl: body.officialUrl }),
        ...(body.productUrlTemplate !== undefined && { productUrlTemplate: body.productUrlTemplate }),
        ...(body.defaultTerms !== undefined && { defaultTerms: body.defaultTerms }),
        ...(body.cancelFeeTerms !== undefined && { cancelFeeTerms: body.cancelFeeTerms }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
