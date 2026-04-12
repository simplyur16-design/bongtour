/**
 * 관리자 API·UI용 — DB raw `brandKey` / `originSource`는 유지하고 응답·화면에서만 canonical 파생값을 쓴다.
 */
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import {
  normalizeSupplierOrigin,
  OVERSEAS_SUPPLIER_LABEL,
  type OverseasSupplierKey,
} from '@/lib/normalize-supplier-origin'
import {
  resolvePublicConsumptionModuleKey,
  type PublicConsumptionModuleKey,
} from '@/lib/resolve-public-consumption-module-key'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'

export type AdminProductSupplierDerivatives = {
  canonicalBrandKey: CanonicalOverseasSupplierKey | null
  normalizedOriginSupplier: OverseasSupplierKey
}

export type AdminProductSupplierApiFields = AdminProductSupplierDerivatives & {
  originSource?: string | null
  brand?: { brandKey?: string | null } | null
}

export function computeAdminProductSupplierDerivatives(args: {
  originSource: string | null | undefined
  brandKey: string | null | undefined
}): AdminProductSupplierDerivatives {
  return {
    canonicalBrandKey: normalizeBrandKeyToCanonicalSupplierKey(args.brandKey),
    normalizedOriginSupplier: normalizeSupplierOrigin(args.originSource),
  }
}

/** API에 파생 필드가 없을 때(구 클라이언트) 동일 규칙으로 재계산 */
export function readAdminProductSupplierDerivatives(
  product: Partial<AdminProductSupplierApiFields> & {
    originSource?: string | null
    brand?: { brandKey?: string | null } | null
  }
): AdminProductSupplierDerivatives {
  if (
    Object.prototype.hasOwnProperty.call(product, 'canonicalBrandKey') &&
    Object.prototype.hasOwnProperty.call(product, 'normalizedOriginSupplier')
  ) {
    return {
      canonicalBrandKey: (product.canonicalBrandKey ?? null) as CanonicalOverseasSupplierKey | null,
      normalizedOriginSupplier: product.normalizedOriginSupplier as OverseasSupplierKey,
    }
  }
  return computeAdminProductSupplierDerivatives({
    originSource: product.originSource,
    brandKey: product.brand?.brandKey ?? null,
  })
}

export function adminPublicConsumptionModuleKeyFromApiProduct(
  product: Partial<AdminProductSupplierApiFields> & {
    originSource?: string | null
    brand?: { brandKey?: string | null } | null
  }
): PublicConsumptionModuleKey {
  const d = readAdminProductSupplierDerivatives(product)
  const originForResolve =
    d.normalizedOriginSupplier !== 'etc' ? d.normalizedOriginSupplier : (product.originSource ?? '')
  return resolvePublicConsumptionModuleKey(
    d.canonicalBrandKey ?? product.brand?.brandKey ?? null,
    originForResolve
  )
}

/** canonical → 한글 상호 우선, 없으면 `formatOriginSourceForDisplay`(raw·etc 대비). */
export function adminSupplierPrimaryDisplayLabel(
  product: Partial<AdminProductSupplierApiFields> & { originSource?: string | null }
): string {
  const d = readAdminProductSupplierDerivatives(product)
  if (d.canonicalBrandKey) return OVERSEAS_SUPPLIER_LABEL[d.canonicalBrandKey]
  if (d.normalizedOriginSupplier !== 'etc') return OVERSEAS_SUPPLIER_LABEL[d.normalizedOriginSupplier]
  return formatOriginSourceForDisplay(product.originSource)
}
