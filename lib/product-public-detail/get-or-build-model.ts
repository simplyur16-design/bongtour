import type { ProductDetailPageLoadRow } from '@/lib/product-detail-page-include'
import { productDetailPayloadByteLength } from '@/lib/product-detail-payload-hit'
import {
  buildProductPublicDetailRenderModel,
  type FitMasterWithDays,
  type ProductDetailViewRow,
} from '@/lib/product-public-detail/build-render-model'
import { bookableMinDateYmdForPayload, parseProductPublicDetailPayload } from '@/lib/product-public-detail/payload-io'
import { finalizeProductPublicDetailPayloadJson } from '@/lib/product-public-detail/build-product-public-detail-payload'
import { isProductDetailPerfLogEnabled, patchProductDetailPerf } from '@/lib/product-detail-perf'
import { revalidateTag } from 'next/cache'
import { isNextRouterPrefetchRequest } from '@/lib/next-router-prefetch'
import { prisma } from '@/lib/prisma'

export type ProductDetailBuildSource = 'payload' | 'computed'

export type ProductDetailModelResult = {
  model: Awaited<ReturnType<typeof buildProductPublicDetailRenderModel>>
  source: ProductDetailBuildSource
}

/** 캐시된 DTO가 있으면 파싱 생략, 없으면 계산 후 registered 상품은 DB에 저장 */
export async function getOrBuildProductPublicDetailModel(
  travelProduct: ProductDetailPageLoadRow & {
    publicDetailPayloadJson?: string | null
  },
  fitMaster: FitMasterWithDays | null,
): Promise<ProductDetailModelResult> {
  const json = travelProduct.publicDetailPayloadJson ?? null
  if (isProductDetailPerfLogEnabled()) {
    patchProductDetailPerf({ payloadBytes: productDetailPayloadByteLength(json) })
  }

  const bookableYmd = bookableMinDateYmdForPayload()
  const parseStart = isProductDetailPerfLogEnabled() ? Date.now() : 0
  const cached = parseProductPublicDetailPayload(json, bookableYmd)
  if (isProductDetailPerfLogEnabled()) {
    patchProductDetailPerf({ parseMs: Date.now() - parseStart })
  }
  if (cached) {
    if (isProductDetailPerfLogEnabled()) {
      patchProductDetailPerf({ payloadSource: 'payload' })
    }
    return { model: cached, source: 'payload' }
  }

  const model = await buildProductPublicDetailRenderModel(
    travelProduct as ProductDetailViewRow,
    fitMaster,
  )
  if (isProductDetailPerfLogEnabled()) {
    patchProductDetailPerf({ payloadSource: 'computed' })
  }

  if (travelProduct.registrationStatus === 'registered' && !(await isNextRouterPrefetchRequest())) {
    const json = finalizeProductPublicDetailPayloadJson(model, bookableYmd)
    if (!json) {
      return { model, source: 'computed' }
    }
    void prisma.product
      .update({
        where: { id: travelProduct.id },
        data: {
          publicDetailPayloadJson: json,
          publicDetailPayloadBuiltAt: new Date(),
        },
      })
      .then(() => {
        revalidateTag(`product-detail-${travelProduct.id}`)
        revalidateTag('product-detail')
      })
      .catch((err) => {
        console.error('[product-public-detail] persist payload failed', travelProduct.id, err)
      })
  }

  return { model, source: 'computed' }
}
