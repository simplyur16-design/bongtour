import { unstable_cache } from 'next/cache'
import { cache as reactCache } from 'react'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import {
  buildProductDetailPageSelect,
  type ProductDetailPageLoadRow,
  type ProductDetailPageRow,
} from '@/lib/product-detail-page-include'
import type { ProductDetailSelectKind } from '@/lib/product-detail-perf'
import { loadProductDetailRowSmartPublic } from '@/lib/product-detail-smart-load'
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

export type ProductDetailCachedLoad = {
  row: ProductDetailPageLoadRow | null
  selectKind: ProductDetailSelectKind
}

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

async function loadProductDetailRowFull(
  productId: string,
  allowAdminDraftFallback: boolean,
): Promise<ProductDetailPageRow | null> {
  let row = await prisma.product.findFirst({
    where: {
      id: productId,
      registrationStatus: 'registered',
      AND: [publicProductWhereClause()],
    },
    select: buildProductDetailPageSelect(new Date()),
  })
  if (!row && allowAdminDraftFallback) {
    row = await prisma.product.findFirst({
      where: { id: productId },
      select: buildProductDetailPageSelect(new Date()),
    })
  }
  return row
}

function loadProductDetailRowCachedPublic(productId: string): Promise<ProductDetailCachedLoad> {
  return unstable_cache(
    () => {
      productDetailUnstableCacheMiss = true
      return loadProductDetailRowSmartPublic(productId)
    },
    ['product-detail-public-v3', productId],
    { revalidate: 3600, tags: [`product-detail-${productId}`, 'product-detail'] },
  )()
}

export const loadProductDetailRowCached = reactCache(
  async (productId: string, allowAdminDraftFallback: boolean): Promise<ProductDetailCachedLoad> => {
    productDetailUnstableCacheMiss = null
    if (allowAdminDraftFallback) {
      productDetailUnstableCacheMiss = true
      const row = await loadProductDetailRowFull(productId, true)
      return { row, selectKind: 'draft' }
    }
    const loaded = await loadProductDetailRowCachedPublic(productId)
    if (productDetailUnstableCacheMiss === null) {
      productDetailUnstableCacheMiss = false
    }
    return loaded
  },
)
