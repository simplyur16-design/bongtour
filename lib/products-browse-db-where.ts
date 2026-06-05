import type { Prisma } from '@prisma/client'
import {
  AIR_HOTEL_BROWSE_TYPE,
  AIR_HOTEL_LISTING_KIND,
  AIR_HOTEL_PRODUCT_TYPE,
  isAirHotelBrowseCategoryToken,
  parseAirHotelBrowseTypeParam,
} from '@/lib/air-hotel-product-ssot'
import type { ListingKind } from '@/lib/product-listing-kind'

function parseBrowseTypeForWhere(raw: string | null): typeof AIR_HOTEL_BROWSE_TYPE | 'travel' | null {
  return parseAirHotelBrowseTypeParam(raw)
}

/**
 * browse `findMany` — listingKind·허브 슬라이스를 DB where로 push-down.
 * 해외·국내 허브 기본 목록은 air_hotel_free 제외(자유여행은 `/travel/air-hotel`).
 */
export function prismaWhereClausesForBrowseListingSlice(input: {
  scope: string | null
  typeParam: string | null
  listingKindParsed: ListingKind | null
  /** @deprecated `airHotelCategory` */
  airtelCategory?: boolean
  airHotelCategory?: boolean
}): Prisma.ProductWhereInput[] {
  const clauses: Prisma.ProductWhereInput[] = [{ NOT: { listingKind: 'overseas_training' } }]

  const categoryFlag = input.airHotelCategory ?? input.airtelCategory ?? false
  const wantsAirHotelHubSlice =
    parseBrowseTypeForWhere(input.typeParam) === AIR_HOTEL_BROWSE_TYPE ||
    categoryFlag ||
    input.listingKindParsed === AIR_HOTEL_LISTING_KIND ||
    (input.typeParam != null && isAirHotelBrowseCategoryToken(input.typeParam))

  if (wantsAirHotelHubSlice) {
    clauses.push({
      OR: [
        { listingKind: AIR_HOTEL_LISTING_KIND },
        { productType: AIR_HOTEL_PRODUCT_TYPE },
        { productType: 'airtel' },
        { productType: 'air-tel' },
        { productType: 'air_hotel' },
      ],
    })
    return clauses
  }

  if (input.listingKindParsed) {
    if (input.listingKindParsed === 'travel') {
      clauses.push({
        OR: [{ listingKind: 'travel' }, { listingKind: null }, { listingKind: '' }],
      })
    } else {
      clauses.push({ listingKind: input.listingKindParsed })
    }
    return clauses
  }

  const scope = (input.scope ?? '').trim().toLowerCase()
  if ((scope === 'domestic' || scope === 'overseas') && !wantsAirHotelHubSlice) {
    clauses.push({
      OR: [{ listingKind: null }, { listingKind: '' }, { listingKind: { not: AIR_HOTEL_LISTING_KIND } }],
    })
  }

  return clauses
}
