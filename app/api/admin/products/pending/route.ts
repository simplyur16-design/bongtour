import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { computeAdminProductSupplierDerivatives } from '@/lib/admin-product-supplier-derivatives'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalScheduleDayImageUrl } from '@/lib/final-image-selection'

/** schedule JSON에서 이미지 미보유 여부: 항목 중 하나라도 imageUrl 없으면 true */
function scheduleNeedsImages(schedule: string | null): boolean {
  if (!schedule || typeof schedule !== 'string') return false
  const rows = getScheduleFromProduct({ schedule })
  if (rows.length === 0) return false
  return rows.some((row) => !getFinalScheduleDayImageUrl(row))
}

/**
 * GET /api/admin/products/pending
 * 등록대기 리스트: registrationStatus가 'pending'이거나 null/빈 문자열인 상품만.
 * on_hold(보류), rejected(반려)는 제외.
 * photosReady: 메인 이미지 + 일정 이미지가 모두 있으면 true.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const list = await prisma.product.findMany({
      where: {
        OR: [
          { registrationStatus: null },
          { registrationStatus: '' },
          { registrationStatus: 'pending' },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        originCode: true,
        originSource: true,
        brand: { select: { brandKey: true } },
        title: true,
        destination: true,
        duration: true,
        updatedAt: true,
        bgImageUrl: true,
        schedule: true,
        primaryRegion: true,
        displayCategory: true,
      },
    })
    const rows = list.map((p) => {
      const supplierDeriv = computeAdminProductSupplierDerivatives({
        brandKey: p.brand?.brandKey ?? null,
        originSource: p.originSource,
      })
      return {
      id: p.id,
      originCode: p.originCode,
      originSource: p.originSource,
      canonicalBrandKey: supplierDeriv.canonicalBrandKey,
      normalizedOriginSupplier: supplierDeriv.normalizedOriginSupplier,
      title: p.title,
      destination: p.destination,
      duration: p.duration,
      updatedAt: p.updatedAt,
      photosReady: !!p.bgImageUrl && !scheduleNeedsImages(p.schedule),
      primaryRegion: p.primaryRegion ?? null,
      displayCategory: p.displayCategory ?? null,
    }
    })
    return NextResponse.json(rows)
  } catch (e) {
    console.error('products/pending:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
