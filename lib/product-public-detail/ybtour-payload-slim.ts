import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'
import type {
  ProductPublicDetailPackageRenderModel,
  YbtourDetailProductPayloadSlice,
} from '@/lib/product-public-detail/types'

/** persist·DTO — ybtour 전용 히어로 항공만 (viewProduct 중복 제거) */
export function slimYbtourDetailProductForPayload(
  model: ProductPublicDetailPackageRenderModel,
): YbtourDetailProductPayloadSlice | null {
  if (model.publicConsumptionModuleKey !== 'ybtour') return null
  const src = model.ybtourDetailProduct
  const hero = src?.ybtourFlightStructuredForHero ?? null
  if (hero == null) return null
  return { ybtourFlightStructuredForHero: hero }
}

/** payload hit·live build 공통 — Ybtour 상세 컴포넌트에 넘길 TravelProduct */
export function mergeViewProductWithYbtourSlice(
  viewProduct: TravelProduct,
  slice: YbtourDetailProductPayloadSlice | null,
): TravelProduct {
  if (!slice) return viewProduct
  return { ...viewProduct, ...slice }
}
