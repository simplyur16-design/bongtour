import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { PRODUCT_DETAIL_PAGE_INCLUDE } from '@/lib/product-detail-page-include'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { resolveProductByPathSegment } from '@/lib/resolve-product-by-path-segment'

const PRODUCT_METADATA_SELECT = {
  id: true,
  slug: true,
  title: true,
  primaryDestination: true,
  destination: true,
  bgImageUrl: true,
  schedule: true,
  registrationStatus: true,
  itineraries: { orderBy: { day: 'asc' as const }, select: { day: true, description: true } },
} as const

/** 동일 RSC 요청 안에서 slug 해석·메타·페이지가 중복 조회하지 않도록 */
export const resolveProductByPathSegmentCached = cache((rawSegment: string, allowAdminDraft: boolean) =>
  resolveProductByPathSegment(rawSegment, { allowAdminDraft }),
)

export const loadProductForMetadataCached = cache(async (productId: string) => {
  let p = await prisma.product.findFirst({
    where: {
      id: productId,
      registrationStatus: 'registered',
      AND: [publicProductWhereClause()],
    },
    select: PRODUCT_METADATA_SELECT,
  })
  if (!p) {
    const admin = await requireAdmin()
    if (admin) {
      p = await prisma.product.findFirst({
        where: { id: productId },
        select: PRODUCT_METADATA_SELECT,
      })
    }
  }
  return p
})

export const loadProductDetailRowCached = cache(async (productId: string, allowAdminDraftFallback: boolean) => {
  let row = await prisma.product.findFirst({
    where: {
      id: productId,
      registrationStatus: 'registered',
      AND: [publicProductWhereClause()],
    },
    include: PRODUCT_DETAIL_PAGE_INCLUDE,
  })
  if (!row && allowAdminDraftFallback) {
    row = await prisma.product.findFirst({
      where: { id: productId },
      include: PRODUCT_DETAIL_PAGE_INCLUDE,
    })
  }
  return row
})
