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

const AIR_HOTEL_PRODUCT_TYPE_WHERE = [
  AIR_HOTEL_PRODUCT_TYPE,
  'airtel',
  'air-tel',
  'air_hotel',
] as const

/**
 * browse `findMany` — listingKind·허브 슬라이스를 DB where로 push-down.
 * 국내 허브 기본 목록은 air_hotel_free 제외.
 * 해외 허브: type 없으면 패키지+자유여행. type=travel 패키지, type=air-hotel 자유여행.
 * REGRESSION-FREEZE[overseas-hub-package-fit-split]: type=travel 패키지 슬라이스 — manifest
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
  const browseType = parseBrowseTypeForWhere(input.typeParam)
  const wantsAirHotelHubSlice =
    browseType === AIR_HOTEL_BROWSE_TYPE ||
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

  if (browseType === 'travel') {
    clauses.push({
      NOT: {
        OR: [
          { listingKind: AIR_HOTEL_LISTING_KIND },
          { productType: { in: [...AIR_HOTEL_PRODUCT_TYPE_WHERE] } },
        ],
      },
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
  if (scope === 'domestic' && !wantsAirHotelHubSlice) {
    clauses.push({
      OR: [{ listingKind: null }, { listingKind: '' }, { listingKind: { not: AIR_HOTEL_LISTING_KIND } }],
    })
  }

  return clauses
}
