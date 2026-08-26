/**
 * 등록화면(/admin/register) 설정 → 셀프힐·검증 레인.
 * 패키지 / 자유여행 / 테마여행. 테마는 세 번째 travelScope가 아니라 패키지 + sportsThemeTag.
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: admin 레인 SSOT — manifest
 */
import { isAirHotelListingKind, isAirHotelProductType } from '@/lib/air-hotel-product-ssot'
import {
  SPORTS_THEME_TAG_VALUES,
  type SportsThemeTag,
} from '@/lib/product-listing-kind'

export type RegisterAdminLane = 'package' | 'air_hotel_free' | 'theme'

export const REGISTER_ADMIN_LANE_LABELS: Record<RegisterAdminLane, string> = {
  package: '해외 패키지',
  air_hotel_free: '자유여행',
  theme: '테마여행',
}

export function canonicalSportsThemeTags(
  raw: readonly string[] | null | undefined,
): SportsThemeTag[] {
  const seen = new Set((raw ?? []).map((x) => String(x).trim()))
  return SPORTS_THEME_TAG_VALUES.filter((k) => seen.has(k))
}

/**
 * 등록화면 값(또는 confirm 후 저장된 Product 필드)만 본다.
 * 명시 자유여행은 테마 태그·URL 추론보다 앞선다.
 */
export function resolveRegisterAdminLane(args: {
  adminTravelScope?: string | null
  listingKind?: string | null
  productType?: string | null
  sportsThemeTag?: readonly string[] | null
}): RegisterAdminLane {
  const adminScope = String(args.adminTravelScope ?? '').trim()
  if (adminScope === 'air_hotel_free') return 'air_hotel_free'
  if (isAirHotelListingKind(args.listingKind) || isAirHotelProductType(args.productType)) {
    return 'air_hotel_free'
  }
  if (canonicalSportsThemeTags(args.sportsThemeTag).length > 0) return 'theme'
  return 'package'
}

export function registerAdminLaneLabel(lane: RegisterAdminLane): string {
  return REGISTER_ADMIN_LANE_LABELS[lane]
}
