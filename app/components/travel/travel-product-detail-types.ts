/**
 * TravelProductDetail 공유 타입 — 컴포넌트 본문과 분리(동적 ItineraryView 청크 순환 참조 방지).
 */
import type { DayHotelPlan } from '@/lib/day-hotel-plans-hanatour'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'
import type { FlightStructuredBody, PublicPricePromotionView, ShoppingStopRow } from '@/lib/public-product-extras'

/** Prisma ProductPrice + quote price* fields (lib/price-utils PriceRowLike compatible) */
export type ProductPriceRow = {
  id: string
  productId: string
  date: string
  adult: number
  childBed: number | null
  childNoBed: number | null
  infant: number | null
  localPrice: string | null
  priceGap: number
  priceAdult: number
  priceChildWithBed: number | null
  priceChildNoBed: number | null
  priceInfant: number | null
  status?: string
  availableSeats?: number
  seatsStatusRaw?: string
}

export type ProductItinerary = { id: number; day: number; description: string }

export type CounselingPoint = {
  title: string
  content: string
  script: string
}

export type ScheduleDay = {
  day: number
  description: string
  imageUrl?: string | null
  imageDisplayName?: string | null
  title?: string
  imageKeyword?: string | null
  imageKeyword2?: string | null
  imageUrl2?: string | null
  imageDisplayName2?: string | null
  imagePhotographer?: string | null
  imageSource?: string | null
  imagePhotographer2?: string | null
  imageSource2?: string | null
  city?: string | null
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
  meals?: string | null
}

export type TravelProduct = {
  id: number | string
  originSource: string
  originCode: string
  title: string
  destination: string
  duration: string
  airline: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  includedText: string | null
  excludedText: string | null
  counselingNotes?: { counseling_points: CounselingPoint[] } | null
  criticalExclusions?: string | null
  productType?: string | null
  airportTransferType?: string | null
  optionalToursStructured?: string | null
  prices: ProductPriceRow[]
  itineraries: ProductItinerary[]
  schedule?: ScheduleDay[] | null
  bgImageUrl?: string | null
  bgImageSource?: string | null
  bgImageIsGenerated?: boolean | null
  bgImagePhotographer?: string | null
  heroCoverCaptionFromAsset?: string | null
  heroImageSeoKeywordOverlay?: string | null
  optionalTours?: Array<{ id: string; name: string; priceUsd: number; duration: string; waitPlaceIfNotJoined: string }>
  shoppingCount?: number | null
  shoppingItems?: string | null
  optionalTourNoticeRaw?: string | null
  optionalTourNoticeItems?: string[]
  optionalTourDisplayNoticeFinal?: string | null
  optionalToursPasteRaw?: string | null
  shoppingVisitCountTotal?: number | null
  shoppingNoticeRaw?: string | null
  shoppingPasteRaw?: string | null
  shoppingStopsStructured?: ShoppingStopRow[] | null
  freeTimeSummaryText?: string | null
  hasFreeTime?: boolean | null
  hasOptionalTours?: boolean | null
  pricePromotionView?: PublicPricePromotionView | null
  benefitSummary?: string | null
  highlightPoints?: string | null
  highlightPointsRaw?: string | null
  promotionLabelsRaw?: string | null
  priceFrom?: number | null
  priceCurrency?: string | null
  departureKeyFactsByDate?: Record<string, DepartureKeyFacts>
  departureKeyFactsByDepartureId?: Record<string, DepartureKeyFacts>
  flightStructured?: FlightStructuredBody | null
  priceTableRawText?: string | null
  hotelSummaryRaw?: string | null
  hotelSummaryText?: string | null
  hotelNames?: string[] | null
  dayHotelPlans?: DayHotelPlan[] | null
  hotelInfoRaw?: string | null
  hotelStatusText?: string | null
  hotelNoticeRaw?: string | null
  primaryRegion?: string | null
  primaryDestination?: string | null
  airtelHotelInfoJson?: string | null
  infantAgeRuleText?: string | null
  childAgeRuleText?: string | null
  reservationNoticeRaw?: string | null
  mustKnowItems?: Array<{ category: string; title: string; body: string; raw?: string }>
  singleRoomSurchargeDisplayText?: string | null
  singleRoomSurchargeAmount?: number | null
  singleRoomSurchargeCurrency?: string | null
  minimumDepartureCount?: number | null
  minimumDepartureText?: string | null
  isDepartureGuaranteed?: boolean | null
  currentBookedCount?: number | null
  remainingSeatsCount?: number | null
  departureStatusText?: string | null
  meetingInfoRaw?: string | null
  meetingPlaceRaw?: string | null
  meetingFallbackText?: string | null
  flightExposurePolicy?: 'public_full' | 'public_limited' | 'admin_only' | null
  flightManualCorrection?: FlightManualCorrectionPayload | null
  applyFlightManualCorrectionOverlay?: boolean
  modetourStickyLocalPayLine?: string | null
  listingKind?: string | null
  flightAdminJson?: string | null
}
