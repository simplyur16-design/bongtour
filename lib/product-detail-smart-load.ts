import { prisma } from '@/lib/prisma'
import {
  buildProductDetailPageSelect,
  buildProductDetailSlimSelect,
  type ProductDetailPageRow,
  type ProductDetailSlimRow,
} from '@/lib/product-detail-page-include'
import { productDetailPayloadDtoHit } from '@/lib/product-detail-payload-hit'
import type { ProductDetailSelectKind } from '@/lib/product-detail-perf'
import { logQ5Trigger } from '@/lib/q5-trigger-log'
import { publicProductWhereClause } from '@/lib/product-sales-policy'

export type ProductDetailSmartLoad = {
  row: ProductDetailPageRow | ProductDetailSlimRow | null
  selectKind: ProductDetailSelectKind
}

async function loadProductDetailRowFull(productId: string, context: string): Promise<ProductDetailPageRow | null> {
  logQ5Trigger('smart-load', productId, context)
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

  const context = slim ? 'dto-miss' : 'slim-row-missing'
  const full = await loadProductDetailRowFull(productId, context)
  return { row: full, selectKind: 'full' }
}
