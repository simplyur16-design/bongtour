import { parseProductRawMetaPublic } from '@/lib/public-product-extras'

/** rawMeta.pricePromotion.merged — 사용자 취소선과 무관한 검수용 참고가 */
export type PromotionReferencePrices = {
  basePrice: number | null
  salePrice: number | null
}

export function promotionReferencePricesFromRawMeta(
  rawMeta: string | null | undefined
): PromotionReferencePrices | null {
  const rawParsed = parseProductRawMetaPublic(rawMeta ?? null)
  const merged = rawParsed?.pricePromotion?.merged
  if (!merged) return null
  const basePrice = merged.basePrice ?? null
  const salePrice = merged.salePrice ?? null
  if (basePrice == null && salePrice == null) return null
  return { basePrice, salePrice }
}

export function adminProductJsonWithPromotionRef<T extends { rawMeta?: string | null }>(
  product: T
): Omit<T, 'rawMeta'> & { promotionReferencePrices: PromotionReferencePrices | null } {
  const { rawMeta, ...rest } = product
  return {
    ...(rest as Omit<T, 'rawMeta'>),
    promotionReferencePrices: promotionReferencePricesFromRawMeta(rawMeta),
  }
}
