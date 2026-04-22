import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { OverseasSupplierKey } from '@/lib/normalize-supplier-origin'

export type ProductPrice = {
  id: string
  date: string
  adult: number
  childBed: number | null
  childNoBed: number | null
  infant: number | null
  priceGap: number | null
}

export type ScheduleEntry = {
  day: number
  title?: string
  description?: string
  imageKeyword?: string
  imageUrl?: string | null
  imageSource?: { source?: string; photographer?: string; originalLink?: string }
}

export type PromotionReferencePrices = {
  basePrice: number | null
  salePrice: number | null
}

export type Product = {
  id: string
  originSource: string
  originCode: string
  originUrl?: string | null
  title: string
  destination: string | null
  destinationRaw?: string | null
  primaryDestination?: string | null
  supplierGroupId?: string | null
  productType?: string | null
  airtelHotelInfoJson?: string | null
  airportTransferType?: string | null
  optionalToursStructured?: string | null
  priceFrom?: number | null
  priceCurrency?: string | null
  duration: string | null
  airline: string | null
  schedule: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  includedText: string | null
  excludedText: string | null
  hotelSummaryRaw: string | null
  criticalExclusions: string | null
  shoppingCount: number | null
  shoppingItems: string | null
  shoppingShopOptions?: string | null
  registrationStatus: string | null
  /** rawMeta.pricePromotion.merged — 사용자 취소선과 별개 */
  promotionReferencePrices?: PromotionReferencePrices | null
  bgImageUrl?: string | null
  bgImageSource?: string | null
  bgImagePhotographer?: string | null
  bgImageSourceUrl?: string | null
  bgImageExternalId?: string | null
  bgImageIsGenerated?: boolean
  needsImageReview?: boolean
  imageReviewRequestedAt?: string | null
  prices: ProductPrice[]
  itineraries: { id: number; day: number; description: string }[]
  optionalTours: { id: string; name: string; priceUsd: number; duration: string | null }[]
  rawMeta?: string | null
  counselingNotes?: string | null
  flightAdminJson?: string | null
  flightManualCorrection?: FlightManualCorrectionPayload | null
  brand?: { brandKey?: string | null } | null
  /** GET/PATCH 응답 파생 — DB 비저장, canonical supplier 기준 */
  canonicalBrandKey?: CanonicalOverseasSupplierKey | null
  normalizedOriginSupplier?: OverseasSupplierKey
  benefitSummary?: string | null
  updatedAt?: string
  /** domestic | overseas — 미설정 시 공개 browse는 기존 목적지/제목 트리아지 */
  travelScope?: string | null
  /** travel | private_trip | air_hotel_free — 미설정 시 제목·유형 추론 */
  listingKind?: string | null
}

/** GET /api/admin/products/[id]/itinerary-days 응답 1건 */
export type ItineraryDayRow = {
  id: string
  productId: string
  day: number
  dateText: string | null
  city: string | null
  summaryTextRaw: string | null
  poiNamesRaw: string | null
  meals: string | null
  accommodation: string | null
  transport: string | null
  notes: string | null
  rawBlock: string | null
}

/** GET /api/admin/products/[id]/departures 응답 1건 */
export type DepartureRow = {
  id: string
  productId: string
  departureDate: string
  adultPrice: number | null
  childBedPrice: number | null
  childNoBedPrice: number | null
  infantPrice: number | null
  localPriceText: string | null
  statusRaw: string | null
  seatsStatusRaw: string | null
  isConfirmed: boolean | null
  isBookable: boolean | null
  minPax: number | null
  syncedAt: string | null
  carrierName: string | null
  outboundFlightNo: string | null
  outboundDepartureAirport: string | null
  outboundDepartureAt: string | null
  outboundArrivalAirport: string | null
  outboundArrivalAt: string | null
  inboundFlightNo: string | null
  inboundDepartureAirport: string | null
  inboundDepartureAt: string | null
  inboundArrivalAirport: string | null
  inboundArrivalAt: string | null
  meetingInfoRaw: string | null
  meetingPointRaw: string | null
  meetingTerminalRaw: string | null
  meetingGuideNoticeRaw: string | null
}

export type OptionalTourDraft = {
  id: string
  name: string
  priceText: string
  priceValue: string
  currency: string
  description: string
  bookingType: 'onsite' | 'pre' | 'inquire' | 'unknown'
  sortOrder: number
  rawText: string
  autoExtracted: boolean
}

export type StructuredSectionView = {
  key: 'flight' | 'hotel' | 'optional' | 'shopping' | 'includedExcluded'
  label: string
  rawPresent: boolean
  structuredSummary: string
}

export type StructuredSignalsView = {
  review: { required: string[]; warning: string[]; info: string[] } | null
  flightStatus: 'success' | 'partial' | 'failure' | null
  exposurePolicy: 'public_full' | 'public_limited' | 'admin_only' | null
  sections: StructuredSectionView[]
  publicConsumption: Array<{
    key: 'hotel' | 'optional' | 'shopping'
    label: string
    source: string
    mode: 'canonical-first' | 'legacy-fallback' | 'none'
  }>
} | null

export type FlightManualFormLegDraft = {
  airline: string
  departureAirport: string
  departureDate: string
  departureTime: string
  arrivalAirport: string
  arrivalDate: string
  arrivalTime: string
  flightNo: string
}

export type FlightManualFormDraft = {
  outbound: FlightManualFormLegDraft
  inbound: FlightManualFormLegDraft
}
