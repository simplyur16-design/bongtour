/**
 * 서버 전용 — 상품별 향후 공개예약가능 출발 회차(마감 제외) 요약·항공사별 회차 목록.
 * browse 카드 출발행(상품당 100회차 상한)과 달리 상한 없이 전 회차를 본다.
 *
 * REGRESSION-FREEZE[airline-variant-group]: 항공사별 가격은 실제 예약가능 회차 항공사만 — manifest
 */
import { prisma } from '@/lib/prisma'
import { buildProductBrowseDepartureSelect } from '@/lib/product-browse-full-include'
import { isBrowseDeparturePublicBookable } from '@/lib/browse-product-seat-bookable'
import { getPublicBookableMinDate, toSeoulYmd } from '@/lib/public-bookable-date'
import {
  airlineParamForLabel,
  departureCarrierPublicLabel,
  summarizeBookableDepartures,
  type BookableDepartureLike,
  type ProductBookableSummary,
} from '@/lib/airline-variant-group'

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

export type AirlineDepartureOption = {
  label: string
  param: string
  minPriceKrw: number
  departures: { ymd: string; priceKrw: number }[]
}

/** 상세 — 항공사별 예약가능 회차(날짜별 그 항공사 최저가). 항공사 모르는 회차는 제외 */
export async function fetchAirlineDepartureOptionsForProduct(
  productId: string,
  baseDate: Date = new Date(),
): Promise<AirlineDepartureOption[]> {
  const deps = (await loadBookableDepartures([productId], baseDate)).get(productId) ?? []
  const byLabel = new Map<string, Map<string, number>>()
  for (const d of deps) {
    const p = d.adultPrice != null && d.adultPrice > 0 ? d.adultPrice : null
    const label = p != null ? departureCarrierPublicLabel(d) : null
    if (!label || p == null) continue
    const m = byLabel.get(label) ?? new Map<string, number>()
    const cur = m.get(d.departureYmd)
    if (cur === undefined || p < cur) m.set(d.departureYmd, p)
    byLabel.set(label, m)
  }
  return [...byLabel.entries()]
    .map(([label, m]) => {
      const departures = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ymd, priceKrw]) => ({ ymd, priceKrw }))
      return { label, param: airlineParamForLabel(label), minPriceKrw: Math.min(...departures.map((x) => x.priceKrw)), departures }
    })
    .sort((a, b) => a.minPriceKrw - b.minPriceKrw || a.label.localeCompare(b.label, 'ko'))
}
