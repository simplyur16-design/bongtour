/**
 * 참좋은여행 항공+호텔(자유여행) 공개 가격 — 본문 연령별 표 SSOT.
 * 패키지는 출발 행 성인가 SSOT, 자유여행은 달력 없이 본문 표만 있는 경우가 많다.
 */
import type { ProductPriceRow } from '@/app/components/travel/TravelProductDetail'
import type { BodyProductPriceTable } from '@/lib/public-product-extras'
import { getPriceAdult } from '@/lib/price-utils'

export function isVerygoodAirtelListing(
  listingKind: string | null | undefined,
  productType: string | null | undefined,
): boolean {
  return listingKind === 'air_hotel_free' || productType === 'airtel'
}

/** 패키지용(성인·아동 본문 덮어쓰기 금지) vs 자유여행용(본문 표 전체) */
export function verygoodPublicMergePriceTable(
  isAirtel: boolean,
  structuredTable: BodyProductPriceTable | null | undefined,
  defaultTable: BodyProductPriceTable | null | undefined,
): BodyProductPriceTable | null | undefined {
  if (!structuredTable) return defaultTable ?? null
  if (isAirtel) return defaultTable ?? structuredTable
  return {
    adultPrice: null,
    childExtraBedPrice: null,
    childNoBedPrice: null,
    infantPrice: structuredTable.infantPrice ?? null,
  }
}

function positive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

/**
 * 출발 행·ProductPrice에 성인가가 없을 때 본문 표·priceFrom으로 공개 달력/견적 행을 채운다.
 */
export function backfillVerygoodAirtelPublicPriceRows(
  rows: ProductPriceRow[],
  table: BodyProductPriceTable | null | undefined,
  opts: { productId: string; priceFrom?: number | null; fallbackDateYmd: string },
): ProductPriceRow[] {
  const adultFromTable = positive(table?.adultPrice) ?? positive(opts.priceFrom)
  const child = positive(table?.childExtraBedPrice)
  const infant = positive(table?.infantPrice)

  if (adultFromTable == null && child == null && infant == null) return rows

  const hasBookable = rows.some((r) => getPriceAdult(r as never) > 0)
  if (hasBookable) return rows

  const fillRow = (r: ProductPriceRow): ProductPriceRow => {
    const ad = getPriceAdult(r as never)
    const nextAdult = ad > 0 ? ad : (adultFromTable ?? 0)
    const nextChild = positive(r.priceChildWithBed ?? r.childBed) ?? child
    const nextInfant = positive(r.priceInfant ?? r.infant) ?? infant
    return {
      ...r,
      adult: nextAdult,
      priceAdult: nextAdult,
      childBed: nextChild ?? r.childBed ?? 0,
      priceChildWithBed: nextChild ?? r.priceChildWithBed ?? null,
      childNoBed: r.childNoBed ?? 0,
      priceChildNoBed: r.priceChildNoBed ?? null,
      infant: nextInfant ?? r.infant ?? 0,
      priceInfant: nextInfant ?? r.priceInfant ?? null,
    }
  }

  if (rows.length > 0) {
    return rows.map(fillRow)
  }

  if (adultFromTable == null) return rows

  const date = opts.fallbackDateYmd.slice(0, 10)
  return [
    {
      id: `verygood-airtel-body-${opts.productId}`,
      productId: opts.productId,
      date,
      adult: adultFromTable,
      childBed: child ?? 0,
      childNoBed: 0,
      infant: infant ?? 0,
      localPrice: null,
      priceGap: 0,
      priceAdult: adultFromTable,
      priceChildWithBed: child,
      priceChildNoBed: null,
      priceInfant: infant,
    },
  ]
}
