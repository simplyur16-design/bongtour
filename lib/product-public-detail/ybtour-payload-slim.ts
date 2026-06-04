import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'
import type {
  ProductPublicDetailPackageRenderModel,
  ProductPublicDetailRenderModel,
  YbtourDetailProductPayloadSlice,
} from '@/lib/product-public-detail/types'

/** ybtour payload slim — 해외 패키지(`listingKind=travel`)만. 자유여행·에어텔은 제외 */
export function isYbtourPackageTravelListingKind(listingKind: string | null | undefined): boolean {
  return listingKind !== 'air_hotel_free'
}

/** `air_hotel_free`·`variant=airtel` 은 slim 금지 */
export function shouldSlimYbtourDetailProductForPayload(
  model: ProductPublicDetailRenderModel,
): model is ProductPublicDetailPackageRenderModel {
  if (model.variant !== 'package') return false
  if (model.publicConsumptionModuleKey !== 'ybtour') return false
  return isYbtourPackageTravelListingKind(model.viewProduct.listingKind)
}

/** persist·DTO — ybtour 패키지 travel 전용 히어로 항공만 (viewProduct 중복 제거) */
export function slimYbtourDetailProductForPayload(
  model: ProductPublicDetailRenderModel,
): YbtourDetailProductPayloadSlice | null {
  if (!shouldSlimYbtourDetailProductForPayload(model)) return null
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
