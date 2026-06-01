import type { ResultItem } from '@/components/products/ProductResultsList'
import type { ProductDetailCardPreview } from '@/lib/product-detail-card-preview'

export function productDetailCardPreviewFromResultItem(
  item: ResultItem,
  formatWon: (n: number | null) => string,
): ProductDetailCardPreview {
  const href =
    item.hasUrgentDeal && item.urgentDealNextDepartureDate
      ? `/products/${item.id}?departure=${encodeURIComponent(item.urgentDealNextDepartureDate)}`
      : `/products/${item.id}`

  const priceKrw =
    item.hasUrgentDeal && item.urgentDealCurrentPriceKrw != null
      ? item.urgentDealCurrentPriceKrw
      : item.effectivePricePerPersonKrw

  return {
    id: item.id,
    title: item.title,
    originSource: item.originSource,
    primaryDestination: item.primaryDestination,
    duration: item.duration,
    imageUrl: (item.coverImageUrl ?? item.bgImageUrl ?? '').trim() || null,
    priceKrw,
    priceLabel: priceKrw != null ? formatWon(priceKrw) : null,
    href,
    savedAt: Date.now(),
  }
}
