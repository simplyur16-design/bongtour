/**
 * 단일 출발 상품 — 공급사 공통 운영 메타.
 * 등록 시 관리자가 체크한 값만 SSOT (LLM·달력 0건 자동 추론 금지).
 *
 * REGRESSION-FREEZE[single-departure-product-ssot]: parse·isSingleDepartureProduct·admin PATCH — manifest
 */
import { isAirHotelProduct } from '@/lib/air-hotel-product-ssot'

export const SINGLE_DEPARTURE_ADMIN_BODY_KEY = 'singleDepartureOnly' as const

/** 관리자 등록 confirm POST 본문 → `Product.singleDepartureOnly` */
export function parseSingleDepartureOnlyFromAdminBody(body: Record<string, unknown>): boolean {
  const raw = body[SINGLE_DEPARTURE_ADMIN_BODY_KEY]
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true
  return false
}

export function isSingleDepartureProduct(p: { singleDepartureOnly?: boolean | null }): boolean {
  return p.singleDepartureOnly === true
}

/** 등록·상품 편집 — 항공+호텔(자유여행)은 단일출발 체크 비활성 */
export function isSingleDepartureAdminCheckboxDisabled(p: {
  travelScope?: string | null
  listingKind?: string | null
  productType?: string | null
}): boolean {
  if ((p.travelScope ?? '').trim() === 'air_hotel_free') return true
  return isAirHotelProduct(p)
}

/** PATCH/confirm — 자유여행이면 항상 false, 아니면 본문 파싱 */
export function resolveSingleDepartureOnlyForAdminWrite(
  body: Record<string, unknown>,
  product: {
    singleDepartureOnly?: boolean | null
    travelScope?: string | null
    listingKind?: string | null
    productType?: string | null
  },
): boolean {
  const listingKind =
    typeof body.listingKind === 'string' ? body.listingKind : (product.listingKind ?? null)
  const productType =
    typeof body.productType === 'string' ? body.productType : (product.productType ?? null)
  const travelScope =
    typeof body.travelScope === 'string' ? body.travelScope : (product.travelScope ?? null)
  if (isSingleDepartureAdminCheckboxDisabled({ travelScope, listingKind, productType })) {
    return false
  }
  if (body[SINGLE_DEPARTURE_ADMIN_BODY_KEY] === undefined) {
    return product.singleDepartureOnly === true
  }
  return parseSingleDepartureOnlyFromAdminBody(body)
}
