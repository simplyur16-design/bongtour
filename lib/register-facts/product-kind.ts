/**
 * register-facts — 패키지 vs 항공+호텔(자유여행) 구분 SSOT.
 * REGRESSION-FREEZE[register-facts-completeness]
 */
import {
  hanatourSaleProdCdLooksAirtelExclusive,
  hanatourSaleProdCdLooksPackage,
  isHanatourAirtelLikeProdInfo,
  parseHanatourPkgCdFromUrl,
  type HanatourPkgProdInfo,
} from '@/lib/hanatour-api-departures'
import type { SupplierRegisterFactSource, SupplierRegisterFactBundle } from '@/lib/register-facts/types'

export type RegisterFactProductKind = 'package' | 'air_hotel_free'

export const REGISTER_FACT_PRODUCT_KIND_NOTE_PREFIX = 'productKind='

export function registerFactProductKindNote(kind: RegisterFactProductKind): string {
  return `${REGISTER_FACT_PRODUCT_KIND_NOTE_PREFIX}${kind}`
}

export function parseRegisterFactProductKind(bundle: SupplierRegisterFactBundle): RegisterFactProductKind {
  for (const note of bundle.notes) {
    if (note.includes(`${REGISTER_FACT_PRODUCT_KIND_NOTE_PREFIX}air_hotel_free`)) {
      return 'air_hotel_free'
    }
  }
  return 'package'
}

/** 관리자 등록 UI travelScope — 명시 선택 시 URL·제목 추론보다 우선 */
// REGRESSION-FREEZE[register-travel-scope-origin-url-fit]: adminTravelScope productKind — manifest
export function resolveRegisterFactProductKindFromAdminTravelScope(
  adminTravelScope: string | null | undefined,
  inferred: RegisterFactProductKind,
): RegisterFactProductKind {
  const t = String(adminTravelScope ?? '').trim()
  if (t === 'air_hotel_free') return 'air_hotel_free'
  if (t === 'overseas' || t === 'domestic') return 'package'
  return inferred
}

/** URL·공급사 휴리스틱 — collect 단계에서 API 확인 전 1차 추정 */
export function inferRegisterFactProductKindFromOriginUrl(
  supplier: SupplierRegisterFactSource,
  originUrl: string,
): RegisterFactProductKind {
  const url = originUrl.trim()
  if (!url) return 'package'
  switch (supplier) {
    case 'ybtour':
      return /[?&]menu=fit\b/i.test(url) ? 'air_hotel_free' : 'package'
    case 'kyowontour':
      return /[?&]menuCode=M53/i.test(url) ? 'air_hotel_free' : 'package'
    case 'verygoodtour':
      return /[?&]MenuCode=leaveLayer/i.test(url) ? 'air_hotel_free' : 'package'
    case 'hanatour': {
      const guessed = inferHanatourListingProductKindFromOriginUrl(url)
      return guessed ?? 'package'
    }
    default:
      return 'package'
  }
}

/** 목록 URL만으로 가를 수 있으면 kind, 아니면 null(API 프로브). */
// REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: hanatour 목록 kind — manifest
export function inferHanatourListingProductKindFromOriginUrl(
  originUrl: string,
): RegisterFactProductKind | null {
  const url = originUrl.trim()
  if (!url) return null
  if (/[?&]type=H01\b/i.test(url)) return 'air_hotel_free'
  const cd = parseHanatourPkgCdFromUrl(url)
  if (!cd) return null
  if (hanatourSaleProdCdLooksAirtelExclusive(cd)) return 'air_hotel_free'
  if (hanatourSaleProdCdLooksPackage(cd)) return 'package'
  return null
}

export function inferHanatourRegisterFactProductKind(
  info: HanatourPkgProdInfo | null | undefined,
  originUrl: string,
): RegisterFactProductKind {
  if (info && isHanatourAirtelLikeProdInfo(info)) return 'air_hotel_free'
  return inferRegisterFactProductKindFromOriginUrl('hanatour', originUrl)
}

export function inferModetourRegisterFactProductKind(detail: Record<string, unknown>): RegisterFactProductKind {
  const hay = [
    detail.groupName,
    detail.productName,
    detail.productTypeName,
    detail.categoryName,
  ]
    .map((x) => String(x ?? ''))
    .join(' ')
  return /에어텔|자유\s*여행|자유\s*\d+\s*일|항공\s*\+\s*호텔|air\s*hotel/i.test(hay) ? 'air_hotel_free' : 'package'
}
