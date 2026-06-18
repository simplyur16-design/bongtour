import { prisma } from '@/lib/prisma'
import {
  buildProductDetailPageSelect,
  buildProductDetailSlimSelect,
  type ProductDetailPageRow,
  type ProductDetailSlimRow,
} from '@/lib/product-detail-page-include'
import { productDetailPayloadDtoHit } from '@/lib/product-detail-payload-hit'
import type { ProductDetailSelectKind } from '@/lib/product-detail-perf'
import { publicProductWhereClause } from '@/lib/product-sales-policy'

export type ProductDetailSmartLoad = {
  row: ProductDetailPageRow | ProductDetailSlimRow | null
  selectKind: ProductDetailSelectKind
}

async function loadProductDetailRowFull(productId: string): Promise<ProductDetailPageRow | null> {
  return prisma.product.findFirst({
    where: {
      id: productId,
      registrationStatus: 'registered',
      AND: [publicProductWhereClause()],
    },
    select: buildProductDetailPageSelect(new Date()),
  })
}

/** Public registered product: slim select on payload DTO hit, else full select. */
export async function loadProductDetailRowSmartPublic(productId: string): Promise<ProductDetailSmartLoad> {
  const slim = await prisma.product.findFirst({
    where: {
      id: productId,
      registrationStatus: 'registered',
      AND: [publicProductWhereClause()],
    },
    select: buildProductDetailSlimSelect(),
  })

  if (slim && productDetailPayloadDtoHit(slim.publicDetailPayloadJson)) {
    return { row: slim as ProductDetailSlimRow, selectKind: 'slim' }
  }

  const full = await loadProductDetailRowFull(productId)
  return { row: full, selectKind: 'full' }
}
