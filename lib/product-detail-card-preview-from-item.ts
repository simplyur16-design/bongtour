import type { GalleryProduct } from '@/app/api/gallery/route'
import type { ResultItem } from '@/components/products/ProductResultsList'
import type { ProductDetailCardPreview } from '@/lib/product-detail-card-preview'
import { publicProductPath } from '@/lib/product-public-path'

export function productDetailCardPreviewFromGalleryProduct(
  product: Pick<
    GalleryProduct,
    'id' | 'title' | 'originSource' | 'primaryDestination' | 'duration' | 'coverImageUrl' | 'priceKrw'
  >,
  formatPrice: (krw: number | null) => string,
): ProductDetailCardPreview {
  const href = publicProductPath({ id: product.id, slug: null })
  const priceKrw = product.priceKrw
  return {
    id: product.id,
    title: product.title,
    originSource: product.originSource,
    primaryDestination: product.primaryDestination,
    duration: product.duration,
    imageUrl: product.coverImageUrl?.trim() || null,
    priceKrw,
    priceLabel: priceKrw != null && priceKrw > 0 ? formatPrice(priceKrw) : null,
    href,
    savedAt: Date.now(),
  }
}

export function productDetailCardPreviewFromResultItem(
  item: ResultItem,
  formatWon: (n: number | null) => string,
): ProductDetailCardPreview {
  const basePath = publicProductPath({ id: item.id, slug: item.slug ?? null })
  const href =
    item.hasUrgentDeal && item.urgentDealNextDepartureDate
      ? `${basePath}?departure=${encodeURIComponent(item.urgentDealNextDepartureDate)}`
      : basePath

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
