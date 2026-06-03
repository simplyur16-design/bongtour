import {
  buildProductPublicDetailRenderModel,
  type FitMasterWithDays,
  type ProductDetailViewRow,
} from '@/lib/product-public-detail/build-render-model'
import {
  bookableMinDateYmdForPayload,
  parseProductPublicDetailPayload,
  serializeProductPublicDetailPayload,
} from '@/lib/product-public-detail/payload-io'
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
  travelProduct: ProductDetailViewRow & {
    publicDetailPayloadJson?: string | null
  },
  fitMaster: FitMasterWithDays | null,
): Promise<ProductDetailModelResult> {
  const bookableYmd = bookableMinDateYmdForPayload()
  const cached = parseProductPublicDetailPayload(
    travelProduct.publicDetailPayloadJson ?? null,
    bookableYmd,
  )
  if (cached) {
    return { model: cached, source: 'payload' }
  }

  const model = await buildProductPublicDetailRenderModel(travelProduct, fitMaster)

  if (travelProduct.registrationStatus === 'registered' && !(await isNextRouterPrefetchRequest())) {
    const json = serializeProductPublicDetailPayload(model, bookableYmd)
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
