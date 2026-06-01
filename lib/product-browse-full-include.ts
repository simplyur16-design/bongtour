/**
 * 상품 목록 browse 전용 — 필터(출발확정·항공시간·요일·현지옵션 등)에 필요한 필드까지 포함.
 * 인당 가격 계산은 `adultPrice`·`departureDate`만 필수이며 나머지는 필터 전용.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPublicBookableMinDate } from '@/lib/public-bookable-date'

/** 목록·필터·정렬에 쓰는 Product 스칼라 — schedule/rawMeta/counselingNotes 등 대용량 JSON·TEXT 제외 */
export function buildProductBrowseListSelect() {
  return {
    id: true,
    originSource: true,
    title: true,
    destination: true,
    destinationRaw: true,
    primaryDestination: true,
    primaryRegion: true,
    continent: true,
    country: true,
    city: true,
    countryKey: true,
    nodeKey: true,
    groupKey: true,
    continentKey: true,
    cityKey: true,
    duration: true,
    airline: true,
    bgImageUrl: true,
    bgImageSource: true,
    bgImageIsGenerated: true,
    publicImageHeroSeoKeywordsJson: true,
    publicImageHeroSeoLine: true,
    productType: true,
    listingKind: true,
    airportTransferType: true,
    airtelHotelInfoJson: true,
    tripDays: true,
    shoppingCount: true,
    shoppingVisitCountTotal: true,
    hasOptionalTours: true,
    priceFrom: true,
    travelScope: true,
    displayCategory: true,
    includedText: true,
    localDepartureTag: true,
    sportsThemeTag: true,
    hasUrgentDeal: true,
    urgentDealNextDate: true,
    updatedAt: true,
  } satisfies Prisma.ProductSelect
}

export type ProductBrowseFindManyRow = Prisma.ProductGetPayload<{
  select: ReturnType<typeof buildProductBrowseFindManySelect>
}>

export type ProductBrowseFindManyRowWithoutDepartures = Prisma.ProductGetPayload<{
  select: ReturnType<typeof buildProductBrowseFindManySelectWithoutDepartures>
}>

export type ProductBrowseListRow = ProductBrowseFindManyRow

/** browse 관계 — departures는 별도 `fetchBrowseDeparturesByProductIds` */
export function buildProductBrowseRelationSelect() {
  return {
    brand: {
      select: { brandKey: true, displayName: true },
    },
    countryTags: {
      select: {
        countryKey: true,
        nodeKey: true,
      },
    },
    cityTags: {
      select: { cityKey: true },
    },
  } satisfies Prisma.ProductSelect
}

export function buildProductBrowseFindManySelect(baseDate: Date = new Date()) {
  const minDeparture = getPublicBookableMinDate(baseDate)
  return {
    ...buildProductBrowseListSelect(),
    ...buildProductBrowseRelationSelect(),
    departures: {
      where: { departureDate: { gte: minDeparture } },
      orderBy: { departureDate: 'asc' as const },
      select: buildProductBrowseDepartureSelect(),
      take: BROWSE_DEPARTURE_PER_PRODUCT_TAKE,
    },
  }
}

/** Product findMany select — 출발은 별도 조회 (단계 3) */
export function buildProductBrowseFindManySelectWithoutDepartures() {
  return {
    ...buildProductBrowseListSelect(),
    ...buildProductBrowseRelationSelect(),
  }
}

const BROWSE_DEPARTURE_PER_PRODUCT_TAKE = 100

/** browse 출발 행 — 필터·인당가·긴급모객 카드 */
export function buildProductBrowseDepartureSelect() {
  return {
    productId: true,
    adultPrice: true,
    baselineAdultPrice: true,
    departureDate: true,
    minPax: true,
    outboundDepartureAt: true,
    carrierName: true,
  } satisfies Prisma.ProductDepartureSelect
}

export type ProductBrowseDepartureRow = Prisma.ProductDepartureGetPayload<{
  select: ReturnType<typeof buildProductBrowseDepartureSelect>
}>

/** @deprecated `buildProductBrowseFindManySelect()` + 분리 departures 조회 */
export function buildProductBrowseFullInclude(baseDate: Date = new Date()) {
  const minDeparture = getPublicBookableMinDate(baseDate)
  return {
    departures: {
      where: { departureDate: { gte: minDeparture } },
      orderBy: { departureDate: 'asc' as const },
      select: {
        adultPrice: true,
        baselineAdultPrice: true,
        departureDate: true,
        minPax: true,
        outboundDepartureAt: true,
        carrierName: true,
      },
      take: BROWSE_DEPARTURE_PER_PRODUCT_TAKE,
    },
    ...buildProductBrowseRelationSelect(),
  } as const
}

/** @deprecated `buildProductBrowseFullInclude()` 사용 */
export const PRODUCT_BROWSE_FULL_INCLUDE = buildProductBrowseFullInclude()

export type ProductBrowseIncludedRow = ProductBrowseFindManyRowWithoutDepartures & {
  departures: ProductBrowseDepartureRow[]
}

export async function fetchBrowseDeparturesByProductIds(
  productIds: string[],
  baseDate: Date = new Date()
): Promise<Map<string, ProductBrowseDepartureRow[]>> {
  const out = new Map<string, ProductBrowseDepartureRow[]>()
  if (productIds.length === 0) return out

  const minDeparture = getPublicBookableMinDate(baseDate)
  const departures = await prisma.productDeparture.findMany({
    where: {
      productId: { in: productIds },
      departureDate: { gte: minDeparture },
    },
    orderBy: [{ productId: 'asc' }, { departureDate: 'asc' }],
    select: buildProductBrowseDepartureSelect(),
  })

  for (const d of departures) {
    const list = out.get(d.productId) ?? []
    if (list.length >= BROWSE_DEPARTURE_PER_PRODUCT_TAKE) continue
    list.push(d)
    out.set(d.productId, list)
  }
  return out
}

export function attachBrowseDeparturesToProducts(
  rows: ProductBrowseFindManyRowWithoutDepartures[],
  departureByProductId: Map<string, ProductBrowseDepartureRow[]>
): ProductBrowseIncludedRow[] {
  return rows.map((p) => ({
    ...p,
    departures: departureByProductId.get(p.id) ?? [],
  }))
}

export async function fetchProductBrowseScheduleByIds(
  productIds: string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  if (productIds.length === 0) return out
  const rows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, schedule: true },
  })
  for (const r of rows) out.set(r.id, r.schedule)
  return out
}
