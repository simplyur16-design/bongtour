import { AIR_HOTEL_LISTING_KIND, AIR_HOTEL_PRODUCT_TYPE } from '@/lib/air-hotel-product-ssot'
import {
  inferRegisterFactProductKindFromOriginUrl,
  type RegisterFactProductKind,
} from '@/lib/register-facts/product-kind'
import type { SupplierRegisterFactSource } from '@/lib/register-facts/types'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

export type AdminRegisterTravelScopeSelection = 'overseas' | 'air_hotel_free'

/**
 * 관리자 상품 등록(/admin/register)에서 선택한 상품 유형 → Product.travelScope + Product.listingKind + productType(자유여행).
 * 요청 필드명은 기존과 동일하게 `travelScope` 문자열을 사용한다 (스냅샷·지문 호환).
 *
 * - overseas → 해외 패키지형 (여행상품)
 * - air_hotel_free → 항공권+호텔(자유여행). travelScope='overseas' + listingKind='air_hotel_free' + productType='air-hotel' 강제.
 * - legacy `domestic` 요청값은 overseas 로 처리한다.
 */
export type AdminRegisterCategoryMeta = {
  travelScope: string | null
  listingKind: string
  /** admin UI travelScope 선택값 → productType SSOT (regex fallback 없음) */
  productType: string
}

const AIRTEL_TITLE_HINT_RE = /에어텔|자유\s*여행|항공\s*\+\s*호텔|\bair\s*hotel\b/i

function registerFactSourceFromOriginSource(originSource: string): SupplierRegisterFactSource | null {
  const key = normalizeSupplierOrigin(originSource.trim())
  if (
    key === 'hanatour' ||
    key === 'modetour' ||
    key === 'ybtour' ||
    key === 'verygoodtour' ||
    key === 'lottetour' ||
    key === 'kyowontour'
  ) {
    return key
  }
  return null
}

function inferAirHotelFreeFromListingHint(hint: string | null | undefined): boolean {
  const t = String(hint ?? '').trim()
  if (!t) return false
  return AIRTEL_TITLE_HINT_RE.test(t)
}

/** REGRESSION-FREEZE[register-travel-scope-origin-url-fit]: URL·제목 신호로 자유여행 강제 — manifest */
export function resolveRegisterTravelScopeFromRequest(args: {
  bodyTravelScope?: unknown
  originSource: string
  originUrl?: string | null
  listingTitleHint?: string | null
}): AdminRegisterTravelScopeSelection {
  const raw =
    typeof args.bodyTravelScope === 'string' ? args.bodyTravelScope.trim() : String(args.bodyTravelScope ?? '').trim()
  if (raw === 'air_hotel_free') return 'air_hotel_free'
  if (raw === 'domestic') return 'overseas'

  const supplier = registerFactSourceFromOriginSource(args.originSource)
  const url = String(args.originUrl ?? '').trim()
  if (supplier && url) {
    const fromUrl: RegisterFactProductKind = inferRegisterFactProductKindFromOriginUrl(supplier, url)
    if (fromUrl === 'air_hotel_free') return 'air_hotel_free'
  }

  if (inferAirHotelFreeFromListingHint(args.listingTitleHint)) return 'air_hotel_free'

  return 'overseas'
}

export function travelScopeAndListingKindFromAdminRegister(
  bodyTravelScope: string | undefined | null
): AdminRegisterCategoryMeta {
  const t = (bodyTravelScope ?? '').trim()
  if (t === 'air_hotel_free') {
    return {
      travelScope: 'overseas',
      listingKind: AIR_HOTEL_LISTING_KIND,
      productType: AIR_HOTEL_PRODUCT_TYPE,
    }
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
