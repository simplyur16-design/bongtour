import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'
import {
  stripPayloadLeakFieldsFromTravelProduct,
} from '@/lib/product-public-detail/strip-payload-leak-fields'
import {
  slimTravelProductDepartureFactsForPayload,
} from '@/lib/product-public-detail/slim-departure-key-facts-for-payload'
import type { ProductPublicDetailRenderModel } from '@/lib/product-public-detail/types'
import { slimYbtourDetailProductForPayload } from '@/lib/product-public-detail/ybtour-payload-slim'

function prepareViewProduct(product: TravelProduct): TravelProduct {
  return slimTravelProductDepartureFactsForPayload(stripPayloadLeakFieldsFromTravelProduct(product))
}

/** persist 전용 — 런타임 SSR 모델과 분리(중복·누수·비대 필드 제거) */
export function prepareModelForPayloadPersistence(
  model: ProductPublicDetailRenderModel,
): ProductPublicDetailRenderModel {
  if (model.variant === 'airtel') {
    return {
      ...model,
      viewProduct: prepareViewProduct(model.viewProduct),
    }
  }

  const viewProduct = prepareViewProduct(model.viewProduct)
  const ybtourDetailProduct = slimYbtourDetailProductForPayload(model)

  return {
    ...model,
    viewProduct,
    ybtourDetailProduct,
  }
}
