import type { ImageAssetServiceType } from '@/lib/image-asset-ssot'

/** Product.travelScope → image_assets.service_type */
export function productTravelScopeToImageAssetServiceType(
  travelScope: string | null | undefined
): ImageAssetServiceType {
  return travelScope === 'domestic' ? 'domestic' : 'overseas'
}

/** image_assets.supplier_name / slug 입력용 — brandKey 우선, 없으면 originSource */
export function productSupplierLabelForImageAsset(
  originSource: string | null | undefined,
  brandKey: string | null | undefined
): string {
  const b = brandKey?.trim()
  if (b) return b.slice(0, 120)
  const o = originSource?.trim()
  if (o) return o.slice(0, 120)
  return 'supplier'
}
