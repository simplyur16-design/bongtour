/**
 * 관리자 상품 등록(/admin/register)에서 선택한 상품 유형 → Product.travelScope + Product.listingKind.
 * 요청 필드명은 기존과 동일하게 `travelScope` 문자열을 사용한다 (스냅샷·지문 호환).
 *
 * - overseas → 해외 패키지형 (여행상품)
 * - domestic → 국내 패키지형 (여행상품)
 * - air_hotel_free → 항공권+호텔(자유여행). 현재 어드민 UI는 해외 자유여행 단일 옵션 → travelScope='overseas' 강제.
 *   국내 자유여행 옵션 추가 시 분기 확장 필요.
 */
export function travelScopeAndListingKindFromAdminRegister(
  bodyTravelScope: string | undefined | null
): { travelScope: string | null; listingKind: string } {
  const t = (bodyTravelScope ?? '').trim()
  if (t === 'air_hotel_free') {
    return { travelScope: 'overseas', listingKind: 'air_hotel_free' }
  }
  if (t === 'domestic') {
    return { travelScope: 'domestic', listingKind: 'travel' }
  }
  if (t === 'overseas') {
    return { travelScope: 'overseas', listingKind: 'travel' }
  }
  return { travelScope: 'overseas', listingKind: 'travel' }
}
