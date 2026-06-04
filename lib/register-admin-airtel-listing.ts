import { travelScopeAndListingKindFromAdminRegister } from '@/lib/register-admin-travel-category'

/** 관리자 등록 — 항공+호텔(자유여행) vs 패키지 여행상품 구분 */
export function isRegisterAirtelListing(
  travelScope: string | undefined | null,
  parsedProductType?: string | null,
): boolean {
  const meta = travelScopeAndListingKindFromAdminRegister(travelScope)
  if (meta.listingKind === 'air_hotel_free' || meta.productType === 'airtel') return true
  return (parsedProductType ?? '').trim() === 'airtel'
}

/** augment·LLM 직후 — productType=airtel 고정(패키지 일정 키워드 규칙과 분리) */
export function stampRegisterAirtelProductTypeOnParsed<T extends { productType?: string | null }>(
  parsed: T,
  travelScope: string | undefined | null,
): T {
  if (!isRegisterAirtelListing(travelScope, parsed.productType)) return parsed
  return { ...parsed, productType: 'airtel' }
}
