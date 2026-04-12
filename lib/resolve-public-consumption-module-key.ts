import {
  normalizeBrandKeyToCanonicalSupplierKey,
  type CanonicalOverseasSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

/** 공개 상세 `app/products/[id]/page.tsx`의 소비 모듈 분기와 동일한 키. */
export type PublicConsumptionModuleKey = CanonicalOverseasSupplierKey

/**
 * brand 우선, 없으면 originSource 정규화 — 관리자 재조회·FMC·구조화 가시화가 공개와 같은 전용 모듈을 쓰게 한다.
 */
export function resolvePublicConsumptionModuleKey(
  brandKey: string | null | undefined,
  originSource: string | null | undefined
): PublicConsumptionModuleKey {
  const fromBrand = normalizeBrandKeyToCanonicalSupplierKey(brandKey)
  if (fromBrand) return fromBrand
  const norm = normalizeSupplierOrigin(originSource)
  if (norm !== 'etc') return norm
  return 'hanatour'
}
