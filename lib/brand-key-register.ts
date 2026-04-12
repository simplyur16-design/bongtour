/**
 * 관리자 상품등록에서 선택한 브랜드 키 정규화(본문으로 공급사 추정하지 않음).
 * 별칭·레거시 값은 `overseas-supplier-canonical-keys` SSOT로만 귀속한다.
 */
import {
  normalizeBrandKeyToCanonicalSupplierKey,
  SUPPLIER_ORIGIN_CANONICAL,
} from '@/lib/overseas-supplier-canonical-keys'

/**
 * 등록·본문 파싱·검수에 쓰는 brandKey를 단일 식별자로 맞춘다.
 */
export function canonicalBrandKeyForRegister(brandKey: string | null | undefined): string | null {
  return normalizeBrandKeyToCanonicalSupplierKey(brandKey)
}

/** 편명 필수 여부 — 브랜드별 정책 목록만 유지 */
const BRANDS_WITHOUT_REQUIRED_FLIGHT_NUMBER = new Set<string>([SUPPLIER_ORIGIN_CANONICAL.verygoodtour])

export function brandKeyExpectsFlightNumber(brandKey: string | null | undefined): boolean {
  const k = canonicalBrandKeyForRegister(brandKey)
  if (!k) return true
  return !BRANDS_WITHOUT_REQUIRED_FLIGHT_NUMBER.has(k)
}
