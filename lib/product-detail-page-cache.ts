import { unstable_cache } from 'next/cache'
import { cache as reactCache } from 'react'
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

/** PERF-LOG: unstable_cache MISS 시 true (HIT이면 callback 미실행) */
let productDetailUnstableCacheMiss: boolean | null = null

export function consumeProductDetailUnstableCacheMiss(): boolean | null {
  const v = productDetailUnstableCacheMiss
  productDetailUnstableCacheMiss = null
  return v
}

/** 동일 RSC 요청 안에서 slug 해석·메타·페이지가 중복 조회하지 않도록 */
export const resolveProductByPathSegmentCached = reactCache((rawSegment: string, allowAdminDraft: boolean) =>
  resolveProductByPathSegment(rawSegment, { allowAdminDraft }),
)

export const loadProductForMetadataCached = reactCache(async (productId: string) => {
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

async function loadProductDetailRowFresh(productId: string, allowAdminDraftFallback: boolean) {
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
}

function loadProductDetailRowCachedPublic(productId: string) {
  return unstable_cache(
    () => {
      productDetailUnstableCacheMiss = true
      return loadProductDetailRowFresh(productId, false)
    },
    ['product-detail-public-v1', productId],
    { revalidate: 300, tags: [`product-detail-${productId}`, 'product-detail'] },
  )()
}

export const loadProductDetailRowCached = reactCache(async (productId: string, allowAdminDraftFallback: boolean) => {
  productDetailUnstableCacheMiss = null
  if (allowAdminDraftFallback) {
    productDetailUnstableCacheMiss = true
    return loadProductDetailRowFresh(productId, true)
  }
  const row = await loadProductDetailRowCachedPublic(productId)
  if (productDetailUnstableCacheMiss === null) {
    productDetailUnstableCacheMiss = false
  }
  return row
})
