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

function excludeAirHotelFitWhere(): Prisma.ProductWhereInput {
  return {
    NOT: {
      OR: [
        { listingKind: AIR_HOTEL_LISTING_KIND },
        { productType: { in: [...AIR_HOTEL_PRODUCT_TYPE_WHERE] } },
      ],
    },
  }
}

/**
 * browse `findMany` — listingKind·허브 슬라이스를 DB where로 push-down.
 * 국내 허브 기본 목록은 air_hotel_free 제외.
 * 해외 허브(`/travel/overseas`·메가메뉴): 기본·type=travel = 패키지만. 자유여행은 type=air-hotel(`/travel/air-hotel`)만.
 * REGRESSION-FREEZE[overseas-hub-package-fit-split]: overseas default package-only — manifest
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

  if (input.listingKindParsed) {
    if (input.listingKindParsed === 'travel') {
      clauses.push({
        OR: [{ listingKind: 'travel' }, { listingKind: null }, { listingKind: '' }],
      })
      // REGRESSION-FREEZE[overseas-hub-package-fit-split]: listingKind=travel 에도 FIT productType 차단 — manifest
      clauses.push(excludeAirHotelFitWhere())
    } else {
      clauses.push({ listingKind: input.listingKindParsed })
    }
    return clauses
  }

  const scope = (input.scope ?? '').trim().toLowerCase()
  // REGRESSION-FREEZE[overseas-hub-package-fit-split]: type 없어도 overseas=패키지만 (자유여행 혼입 금지) — manifest
  if (browseType === 'travel' || scope === 'overseas') {
    clauses.push(excludeAirHotelFitWhere())
    return clauses
  }

  if (scope === 'domestic' && !wantsAirHotelHubSlice) {
    clauses.push({
      OR: [{ listingKind: null }, { listingKind: '' }, { listingKind: { not: AIR_HOTEL_LISTING_KIND } }],
    })
  }

  return clauses
}
