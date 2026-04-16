/**
 * 고객 상세 — 선택 출발일 기준 전후 범위 on-demand 수집 (`POST /api/products/[id]`).
 * 공급사별 정책은 서버에서 처리하고, 클라이언트는 응답만 해석한다.
 */
import type { ProductPriceRow } from '@/app/components/travel/TravelProductDetail'

type ApiData = {
  ok?: boolean
  reason?: string
  status?: string
  price?: number | null
  cached?: boolean
}

export type ParsedRangeOnDemand =
  | { kind: 'open_row'; row: ProductPriceRow; refreshRouter: boolean }
  | { kind: 'closed_row'; row: ProductPriceRow; notice: string; refreshRouter: boolean }
  | { kind: 'departure_not_found'; refreshRouter: boolean }
  | { kind: 'price_unavailable' }
  | { kind: 'generic_error' }

export function parseRangeOnDemandResponse(
  productId: string,
  isoDate: string,
  data: ApiData
): ParsedRangeOnDemand {
  if (data?.ok === true && data.status === 'open' && data.price != null) {
    const row: ProductPriceRow = {
      id: `od-${isoDate}`,
      productId: String(productId),
      date: isoDate,
      adult: data.price,
      childBed: 0,
      childNoBed: 0,
      infant: 0,
      localPrice: null,
      priceGap: 0,
      priceAdult: data.price,
      priceChildWithBed: 0,
      priceChildNoBed: 0,
      priceInfant: 0,
    }
    return { kind: 'open_row', row, refreshRouter: data?.cached !== true }
  }
  if (data?.ok === true && (data.status === 'sold_out' || data.status === 'closed')) {
    const row: ProductPriceRow = {
      id: `od-${isoDate}`,
      productId: String(productId),
      date: isoDate,
      adult: 0,
      childBed: 0,
      childNoBed: 0,
      infant: 0,
      localPrice: null,
      priceGap: 0,
      priceAdult: 0,
      priceChildWithBed: 0,
      priceChildNoBed: 0,
      priceInfant: 0,
      status: '마감',
    }
    return {
      kind: 'closed_row',
      row,
      notice: '해당 날짜 상품은 마감되었습니다.',
      refreshRouter: data?.cached !== true,
    }
  }
  if (data?.reason === 'departure_not_found') {
    return { kind: 'departure_not_found', refreshRouter: true }
  }
  if (data?.reason === 'departure_exists_price_unavailable') {
    return { kind: 'price_unavailable' }
  }
  return { kind: 'generic_error' }
}

export async function postRangeOnDemandDepartures(
  productId: string,
  departureDateYmd: string,
  windowDays = 14
): Promise<{ ok: boolean; data: ApiData }> {
  const res = await fetch(`/api/products/${encodeURIComponent(String(productId))}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'range-on-demand',
      departureDate: departureDateYmd,
      windowDays,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as ApiData
  return { ok: res.ok, data }
}
