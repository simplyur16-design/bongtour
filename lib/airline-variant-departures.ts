/**
 * 서버 전용 — 상품별 향후 공개예약가능 출발 회차(마감 제외) 요약·항공사별 회차 목록.
 * browse 카드 출발행(상품당 100회차 상한)과 달리 상한 없이 전 회차를 본다.
 *
 * REGRESSION-FREEZE[airline-variant-group]: 항공사별 가격은 실제 예약가능 회차 항공사만 — manifest
 */
import { prisma } from '@/lib/prisma'
import { buildProductBrowseDepartureSelect } from '@/lib/product-browse-full-include'
import { buildProductDetailDepartureSelect } from '@/lib/product-detail-page-include'
import { isBrowseDeparturePublicBookable } from '@/lib/browse-product-seat-bookable'
import { getPublicBookableMinDate, toSeoulYmd } from '@/lib/public-bookable-date'
import { resolvePublicConsumptionModuleKey } from '@/lib/resolve-public-consumption-module-key'
import * as priceRowsHanatour from '@/lib/product-departure-to-price-rows-hanatour'
import * as priceRowsModetour from '@/lib/product-departure-to-price-rows-modetour'
import * as priceRowsVerygoodtour from '@/lib/product-departure-to-price-rows-verygoodtour'
import * as priceRowsYbtour from '@/lib/product-departure-to-price-rows-ybtour'
import * as priceRowsKyowontour from '@/lib/product-departure-to-price-rows-kyowontour'
import * as priceRowsLottetour from '@/lib/product-departure-to-price-rows-lottetour'
import * as priceRowsNaeiltour from '@/lib/product-departure-to-price-rows-naeiltour'
import {
  airlineOptionsFromPriceRows,
  departureCarrierPublicLabel,
  summarizeBookableDepartures,
  type BookableDepartureLike,
  type ProductAirlineFilterData,
  type ProductBookableSummary,
} from '@/lib/airline-variant-group'

export type { AirlineDepartureOption, ProductAirlineFilterData } from '@/lib/airline-variant-group'

async function loadBookableDepartures(
  productIds: string[],
  baseDate: Date,
): Promise<Map<string, BookableDepartureLike[]>> {
  const out = new Map<string, BookableDepartureLike[]>()
  if (productIds.length === 0) return out
  const rows = await prisma.productDeparture.findMany({
    where: { productId: { in: productIds }, departureDate: { gte: getPublicBookableMinDate(baseDate) } },
    orderBy: [{ productId: 'asc' }, { departureDate: 'asc' }],
    select: { ...buildProductBrowseDepartureSelect(), outboundFlightNo: true },
  })
  for (const d of rows) {
    if (!isBrowseDeparturePublicBookable(d)) continue
    const list = out.get(d.productId) ?? []
    list.push({
      departureYmd: toSeoulYmd(d.departureDate),
      adultPrice: d.adultPrice,
      carrierName: d.carrierName,
      outboundFlightNo: d.outboundFlightNo,
    })
    out.set(d.productId, list)
  }
  return out
}

/** 상품 id → 요약 (예약가능 회차가 없는 상품은 minPriceKrw null) */
export async function fetchProductBookableSummaries(
  products: { id: string; slug: string | null }[],
  baseDate: Date = new Date(),
): Promise<Map<string, ProductBookableSummary>> {
  const ids = [...new Set(products.map((p) => p.id))]
  const deps = await loadBookableDepartures(ids, baseDate)
  const out = new Map<string, ProductBookableSummary>()
  for (const p of products) {
    if (out.has(p.id)) continue
    out.set(p.id, summarizeBookableDepartures(p.id, p.slug, deps.get(p.id) ?? []))
  }
  return out
}

export type AirlineDepartureListOption = {
  label: string
  param: string
  minPriceKrw: number
  departures: { ymd: string; priceKrw: number }[]
}

/** 상세 — 항공사별 예약가능 회차 날짜·가격(목록용) */
export async function fetchAirlineDepartureOptionsForProduct(
  productId: string,
  baseDate: Date = new Date(),
): Promise<AirlineDepartureListOption[]> {
  const data = await fetchAirlineFilterDataForProduct(productId, baseDate)
  return (data?.options ?? []).map((o) => ({
    label: o.label,
    param: o.param,
    minPriceKrw: o.minPriceKrw,
    departures: o.rows.map((r) => ({ ymd: r[1], priceKrw: r[2] })),
  }))
}

function priceRowsModuleFor(key: string) {
  switch (key) {
    case 'modetour':
      return priceRowsModetour
    case 'verygoodtour':
      return priceRowsVerygoodtour
    case 'ybtour':
      return priceRowsYbtour
    case 'kyowontour':
      return priceRowsKyowontour
    case 'lottetour':
      return priceRowsLottetour
    case 'naeiltour':
      return priceRowsNaeiltour
    default:
      return priceRowsHanatour
  }
}

/**
 * 상세 달력·가격 항공사 필터 데이터 — 향후 공개예약가능 회차(마감 제외, 상한 없음)를
 * 상세와 같은 공급사 가격행 변환으로 만든 뒤 항공사별·날짜별 최저가 1행.
 * 항공사 데이터 없는 상품은 null → 필터 UI 없음, 상세는 기존 그대로.
 */
export async function fetchAirlineFilterDataForProduct(
  productId: string,
  baseDate: Date = new Date(),
): Promise<ProductAirlineFilterData | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { originSource: true, brand: { select: { brandKey: true } } },
  })
  if (!product) return null
  const rows = await prisma.productDeparture.findMany({
    where: { productId, departureDate: { gte: getPublicBookableMinDate(baseDate) } },
    orderBy: { departureDate: 'asc' },
    select: {
      ...buildProductBrowseDepartureSelect(),
      ...buildProductDetailDepartureSelect(),
      id: true,
      productId: true,
      outboundFlightNo: true,
    },
  })
  const bookable = rows.filter((d) => isBrowseDeparturePublicBookable(d))
  if (bookable.length === 0) return null
  const labelById = new Map<string, string | null>()
  for (const d of bookable) labelById.set(d.id, departureCarrierPublicLabel(d))
  if (![...labelById.values()].some(Boolean)) return null
  const mod = priceRowsModuleFor(
    resolvePublicConsumptionModuleKey(product.brand?.brandKey, product.originSource),
  )
  const priceRows = mod.productDeparturesToProductPriceRows(
    bookable as unknown as Parameters<typeof mod.productDeparturesToProductPriceRows>[0],
  )
  const options = airlineOptionsFromPriceRows(
    priceRows.map((row) => ({ row, label: labelById.get(String(row.id)) ?? null })),
  )
  return options.length > 0 ? { options } : null
}
