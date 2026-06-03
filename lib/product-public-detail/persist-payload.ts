import { prisma } from '@/lib/prisma'
import { buildProductDetailPageSelect } from '@/lib/product-detail-page-include'
import type { FitMasterWithDays } from '@/lib/product-public-detail/build-render-model'
import { buildProductPublicDetailPayload } from '@/lib/product-public-detail/build-product-public-detail-payload'

async function loadFitMasterForProduct(productId: string, productType: string | null) {
  if (productType !== 'airtel') return null
  const fitMaster = await prisma.fitItineraryMaster.findFirst({
    where: { productId, status: 'published' },
    include: {
      days: {
        orderBy: { dayNumber: 'asc' },
        include: {
          activities: {
            orderBy: { order: 'asc' },
            include: { validation: true },
          },
        },
      },
    },
  })
  return fitMaster as FitMasterWithDays | null
}

/** 등록·동기화·관리자 저장 후 호출 — 상세 SSR 파싱 생략용 DTO 저장 */
export async function rebuildProductPublicDetailPayload(productId: string): Promise<boolean> {
  const row = await prisma.product.findFirst({
    where: { id: productId },
    select: buildProductDetailPageSelect(new Date()),
  })
  if (!row || row.registrationStatus !== 'registered') {
    await prisma.product.updateMany({
      where: { id: productId },
      data: {
        publicDetailPayloadJson: null,
        publicDetailPayloadBuiltAt: null,
      },
    })
    return false
  }

  const fitMaster = await loadFitMasterForProduct(productId, row.productType ?? null)
  const json = await buildProductPublicDetailPayload(row, fitMaster)
  if (!json) {
    await prisma.product.updateMany({
      where: { id: productId },
      data: {
        publicDetailPayloadJson: null,
        publicDetailPayloadBuiltAt: null,
      },
    })
    return false
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      publicDetailPayloadJson: json,
      publicDetailPayloadBuiltAt: new Date(),
    },
  })
  return true
}
