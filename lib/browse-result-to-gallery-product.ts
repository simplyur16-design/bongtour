import type { GalleryProduct } from '@/app/api/gallery/route'
import type { ResultItem } from '@/components/products/ProductResultsList'

/** browse `ResultItem` → `OverseasCompareCard`용 최소 `GalleryProduct` */
export function browseResultToGalleryProduct(item: ResultItem): GalleryProduct {
  const cover = (item.coverImageUrl ?? item.bgImageUrl ?? '').trim()
  return {
    id: item.id,
    title: item.title,
    originSource: item.originSource,
    bgImageSource: item.bgImageUrl,
    bgImageIsGenerated: false,
    primaryDestination: item.primaryDestination,
    destinationRaw: null,
    destination: item.primaryDestination,
    primaryRegion: item.primaryRegion ?? null,
    themeTags: null,
    displayCategory: null,
    includedText: null,
    publicImageHeroSeoLine: null,
    publicImageHeroSeoKeywordsJson: item.coverImageSeoKeyword
      ? JSON.stringify([item.coverImageSeoKeyword])
      : null,
    departureDate: item.earliestDeparture ?? null,
    duration: item.duration ?? '',
    priceKrw: item.effectivePricePerPersonKrw,
    coverImageUrl: cover,
    imageSet: cover ? [cover] : [],
  }
}
