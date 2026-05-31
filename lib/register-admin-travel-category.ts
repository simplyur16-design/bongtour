/**
 * 관리자 상품 등록(/admin/register)에서 선택한 상품 유형 → Product.travelScope + Product.listingKind + productType(자유여행).
 * 요청 필드명은 기존과 동일하게 `travelScope` 문자열을 사용한다 (스냅샷·지문 호환).
 *
 * - overseas → 해외 패키지형 (여행상품)
 * - domestic → 국내 패키지형 (여행상품)
 * - air_hotel_free → 항공권+호텔(자유여행). travelScope='overseas' + listingKind='air_hotel_free' + productType='airtel' 강제.
 *   국내 자유여행 옵션 추가 시 분기 확장 필요.
 */
export type AdminRegisterCategoryMeta = {
  travelScope: string | null
  listingKind: string
  /** admin UI travelScope 선택값 → productType SSOT (regex fallback 없음) */
  productType: string
}

export function travelScopeAndListingKindFromAdminRegister(
  bodyTravelScope: string | undefined | null
): AdminRegisterCategoryMeta {
  const t = (bodyTravelScope ?? '').trim()
  if (t === 'air_hotel_free') {
    return { travelScope: 'overseas', listingKind: 'air_hotel_free', productType: 'airtel' }
  }
  if (t === 'domestic') {
    return { travelScope: 'domestic', listingKind: 'travel', productType: 'travel' }
  }
  return { travelScope: 'overseas', listingKind: 'travel', productType: 'travel' }
}

/** admin UI travelScope SSOT — parsed.productType 인자는 호환성용(미사용) */
export function resolveRegisterProductType(
  adminMeta: AdminRegisterCategoryMeta,
  _parsedProductType: string | null | undefined
): string {
  return adminMeta.productType ?? 'travel'
}
