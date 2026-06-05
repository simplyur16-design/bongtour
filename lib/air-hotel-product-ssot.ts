/**
 * 항공+호텔(자유여행) — URL·browse·productType·listingKind SSOT.
 * DB `listingKind` 값(`air_hotel_free`)은 스키마 호환으로 유지.
 * 레거시 `productType: airtel`·`?type=airtel`·`?type=free` 는 읽기만 호환.
 */
import type { ListingKind } from '@/lib/product-listing-kind'
import { parseListingKind } from '@/lib/product-listing-kind'

/** Prisma `Product.listingKind` */
export const AIR_HOTEL_LISTING_KIND = 'air_hotel_free' as const satisfies ListingKind

/** 신규·갱신 `Product.productType` */
export const AIR_HOTEL_PRODUCT_TYPE = 'air-hotel' as const

/** browse `?type=` · `ProductBrowseType` */
export const AIR_HOTEL_BROWSE_TYPE = 'air-hotel' as const

export type AirHotelBrowseType = typeof AIR_HOTEL_BROWSE_TYPE

const LEGACY_PRODUCT_TYPE_ALIASES = new Set([
  'airtel',
  'air-tel',
  'air tel',
  'air_hotel',
  'air-hotel',
  AIR_HOTEL_PRODUCT_TYPE,
])

const LEGACY_BROWSE_TYPE_ALIASES = new Set([
  'airtel',
  'free',
  'air_hotel',
  'air_hotel_free',
  'air-hotel-free',
  AIR_HOTEL_BROWSE_TYPE,
])

export function normalizeAirHotelProductType(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim().toLowerCase()
  if (!t) return null
  if (LEGACY_PRODUCT_TYPE_ALIASES.has(t)) return AIR_HOTEL_PRODUCT_TYPE
  return (raw ?? '').trim()
}

export function isAirHotelProductType(raw: string | null | undefined): boolean {
  return normalizeAirHotelProductType(raw) === AIR_HOTEL_PRODUCT_TYPE
}

export function isAirHotelListingKind(listingKind: string | null | undefined): boolean {
  return (listingKind ?? '').trim() === AIR_HOTEL_LISTING_KIND
}

export function isAirHotelProduct(p: {
  listingKind?: string | null
  productType?: string | null
}): boolean {
  return isAirHotelListingKind(p.listingKind) || isAirHotelProductType(p.productType)
}

/** Gemini 예시 일정(FitItinerary) 생성·persist·상세 노출 대상 */
export function isAirHotelFitItineraryProduct(p: {
  listingKind?: string | null
  productType?: string | null
}): boolean {
  return isAirHotelProduct(p)
}

export function parseAirHotelBrowseTypeParam(raw: string | null | undefined): AirHotelBrowseType | 'travel' | null {
  if (raw == null || raw === '') return null
  const u = raw.toLowerCase().trim()
  if (LEGACY_BROWSE_TYPE_ALIASES.has(u)) return AIR_HOTEL_BROWSE_TYPE
  if (u === 'travel') return 'travel'
  return null
}

/** 사이드바 `category=airtel` 등 레거시 */
export function isAirHotelBrowseCategoryToken(raw: string | null | undefined): boolean {
  if (raw == null || raw === '') return false
  return LEGACY_BROWSE_TYPE_ALIASES.has(raw.toLowerCase().trim())
}

export function wantsAirHotelHubBrowseSlice(input: {
  typeParam: string | null
  airHotelCategory?: boolean
  listingKindRaw?: string | null
}): boolean {
  const listingKindParsed = input.listingKindRaw ? parseListingKind(input.listingKindRaw) : null
  return (
    parseAirHotelBrowseTypeParam(input.typeParam) === AIR_HOTEL_BROWSE_TYPE ||
    input.airHotelCategory === true ||
    listingKindParsed === AIR_HOTEL_LISTING_KIND
  )
}

/** 제목·레거시 productType 추론 — browse 필터용 */
/** 공개 상세 payload `model.variant` — 레거시 `airtel` 호환 */
export function isAirHotelDetailVariant(variant: string | null | undefined): boolean {
  const v = (variant ?? '').trim().toLowerCase()
  return v === 'air-hotel' || v === 'airtel'
}

export function inferAirHotelBrowseTypeFromTitle(productType: string | null, title: string): AirHotelBrowseType | null {
  if (isAirHotelProductType(productType)) return AIR_HOTEL_BROWSE_TYPE
  const hay = `${productType ?? ''} ${title}`.toLowerCase()
  if (/(에어텔|air[\s-]?tel|air[\s-]?hotel)/i.test(hay)) return AIR_HOTEL_BROWSE_TYPE
  if (/(자유여행|자유\s*여행|\bfree\b|항공\s*\+\s*호텔|항공\+호텔)/i.test(hay)) return AIR_HOTEL_BROWSE_TYPE
  return null
}
