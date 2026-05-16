/**
 * 상품 목록 browse 전용 — 필터·카드에 필요한 필드만 select (body/itinerary 등 대용량 제외).
 */
import type { Prisma } from '@prisma/client'

const departureSelect = {
  orderBy: { departureDate: 'asc' as const },
  select: {
    adultPrice: true,
    departureDate: true,
    minPax: true,
    outboundDepartureAt: true,
    carrierName: true,
    isDepartureConfirmed: true,
    statusLabelsRaw: true,
    statusRaw: true,
  },
  take: 80,
} as const

export const PRODUCT_BROWSE_SELECT = {
  id: true,
  title: true,
  originSource: true,
  productType: true,
  listingKind: true,
  airportTransferType: true,
  primaryDestination: true,
  primaryRegion: true,
  destination: true,
  destinationRaw: true,
  duration: true,
  tripDays: true,
  bgImageUrl: true,
  bgImageSource: true,
  bgImageIsGenerated: true,
  publicImageHeroSeoKeywordsJson: true,
  publicImageHeroSeoLine: true,
  priceFrom: true,
  updatedAt: true,
  continent: true,
  country: true,
  city: true,
  countryKey: true,
  continentKey: true,
  cityKey: true,
  localDepartureTag: true,
  travelScope: true,
  displayCategory: true,
  shoppingCount: true,
  shoppingVisitCountTotal: true,
  hasOptionalTours: true,
  airline: true,
  airtelHotelInfoJson: true,
  includedText: true,
  schedule: true,
  departures: departureSelect,
  prices: {
    select: { adult: true },
    take: 40,
    orderBy: { date: 'asc' as const },
  },
  brand: {
    select: { brandKey: true, displayName: true },
  },
  countryTags: {
    select: {
      countryKey: true,
      nodeKey: true,
      groupKey: true,
      country: { select: { continentKey: true } },
    },
  },
  cityTags: {
    select: { cityKey: true },
  },
  _count: {
    select: { optionalTours: true },
  },
} as const satisfies Prisma.ProductSelect

/** @deprecated browse는 PRODUCT_BROWSE_SELECT 사용 */
export const PRODUCT_BROWSE_FULL_INCLUDE = {
  departures: departureSelect,
  prices: PRODUCT_BROWSE_SELECT.prices,
  brand: PRODUCT_BROWSE_SELECT.brand,
  countryTags: PRODUCT_BROWSE_SELECT.countryTags,
  cityTags: PRODUCT_BROWSE_SELECT.cityTags,
  _count: PRODUCT_BROWSE_SELECT._count,
} as const

export type ProductBrowseIncludedRow = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_BROWSE_SELECT
}>
