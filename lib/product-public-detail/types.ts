import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'
import type { ProductJsonLdAggregateOffer, ProductJsonLdItineraryItem } from '@/app/components/seo/ProductJsonLd'
import type { ProductDeparture } from '@prisma/client'
import type { mapFitMasterForItinerary } from '@/lib/product-public-detail/build-render-model'
import type { PublicPersistedFlightStructuredDto } from '@/lib/public-flight-structured-sanitize'

/** DB `Product.publicDetailPayloadJson` envelope — bump when shape changes */
export const PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION = 1

export type ProductPublicDetailPayloadEnvelope = {
  version: typeof PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION
  /** `getPublicBookableMinDate()` 기준 YYYY-MM-DD — 달이 바뀌면 재빌드 */
  bookableMinDateYmd: string
  builtAt: string
  model: ProductPublicDetailRenderModel
}

export type ProductPublicDetailSeoBundle = {
  coverUrl: string
  productDescription: string
  offers: ProductJsonLdAggregateOffer | null
  breadcrumbItems: Array<{ position: number; name: string; item?: string }>
  itinerary: ProductJsonLdItineraryItem[] | null
}

export type ProductPublicDetailAirtelRenderModel = {
  variant: 'airtel'
  serialized: TravelProduct
  priceRowsForPublic: TravelProduct['prices']
  priceInfo: {
    departureDateFrom: string
    departureDateTo: string
    lowestAdultPrice: number
    highestAdultPrice: number
    infantPrice: number
    childBedPrice: number
    minPaxPerDeparture: number | null
    totalDays: number
  }
  masterArg: ReturnType<typeof mapFitMasterForItinerary> | null
  adminFlightRaw: string | null
  heroImageSeoKeywordOverlay: TravelProduct['heroImageSeoKeywordOverlay']
  travelProductScalars: {
    id: string
    originSource: string
    originCode: string
    bgImageUrl: string | null
    bgImagePhotographer: string | null
    bgImagePlaceName: string | null
    bgImageRehostSearchLabel: string | null
    airtelHotelInfoJson: string | null
    duration: string | null
    travelScope: 'domestic' | 'overseas'
    listingKind: string | null
    airportTransferType: string | null
    productType: string
  }
  seo: ProductPublicDetailSeoBundle
  registrationStatus: string | null
}

export type ProductPublicDetailPackageRenderModel = {
  variant: 'package'
  serialized: TravelProduct
  viewProduct: TravelProduct
  ybtourDetailProduct:
    | (TravelProduct & { ybtourFlightStructuredForHero?: PublicPersistedFlightStructuredDto | null })
    | null
  publicConsumptionModuleKey: string
  isPackageItineraryBody: boolean
  isPrivateOrSemi: boolean
  showEsimCrossSell: boolean
  resolvedPriceFrom: number | null
  seo: ProductPublicDetailSeoBundle
  registrationStatus: string | null
  /** SEO·json-ld용 — departures 필터 전 원본 개수 */
  departuresForSeo: Pick<ProductDeparture, 'adultPrice' | 'departureDate' | 'statusRaw' | 'seatsStatusRaw'>[]
}

export type ProductPublicDetailRenderModel =
  | ProductPublicDetailAirtelRenderModel
  | ProductPublicDetailPackageRenderModel
