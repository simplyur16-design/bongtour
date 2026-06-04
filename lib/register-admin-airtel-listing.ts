import {
  AIR_HOTEL_PRODUCT_TYPE,
  isAirHotelListingKind,
  isAirHotelProductType,
} from '@/lib/air-hotel-product-ssot'
import { travelScopeAndListingKindFromAdminRegister } from '@/lib/register-admin-travel-category'

/** 관리자 등록 — 항공+호텔(자유여행) vs 패키지 여행상품 구분 */
export function isRegisterAirHotelListing(
  travelScope: string | undefined | null,
  parsedProductType?: string | null,
): boolean {
  const meta = travelScopeAndListingKindFromAdminRegister(travelScope)
  if (isAirHotelListingKind(meta.listingKind) || isAirHotelProductType(meta.productType)) return true
  return isAirHotelProductType(parsedProductType)
}

/** @deprecated `isRegisterAirHotelListing` */
export const isRegisterAirtelListing = isRegisterAirHotelListing

/** augment·LLM 직후 — productType=air-hotel 고정(패키지 일정 키워드 규칙과 분리) */
export function stampRegisterAirHotelProductTypeOnParsed<T extends { productType?: string | null }>(
  parsed: T,
  travelScope: string | undefined | null,
): T {
  if (!isRegisterAirHotelListing(travelScope, parsed.productType)) return parsed
  return { ...parsed, productType: AIR_HOTEL_PRODUCT_TYPE }
}

/** @deprecated `stampRegisterAirHotelProductTypeOnParsed` */
export const stampRegisterAirtelProductTypeOnParsed = stampRegisterAirHotelProductTypeOnParsed
