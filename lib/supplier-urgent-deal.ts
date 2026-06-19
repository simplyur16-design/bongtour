/**
 * 공급사 공통 긴급모객 — baseline 대비 인하 출발일 판정·Product 캐시 SSOT.
 *
 * REGRESSION-FREEZE[supplier-urgent-deal-baseline]: baselineAdultPrice·hasUrgentDeal — manifest
 */
import type { PrismaClient } from '@prisma/client'

import { addDaysUtcYmd, kstTodayYmd } from '@/lib/product-sales-policy'

export const SUPPLIER_URGENT_DEAL_WINDOW_DAYS = 30
export const SUPPLIER_URGENT_DEAL_MIN_PRICE_KRW = 10_000

export type UrgentDealDepartureRow = {
  departureDate: Date
  adultPrice: number | null
  baselineAdultPrice: number | null
}

export type UrgentDealNearest = {
  departureDateYmd: string
  baseline: number
  current: number
}

export function isValidUrgentDealPrice(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n >= SUPPLIER_URGENT_DEAL_MIN_PRICE_KRW
}

export function departureDateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

/** upsert 시 baseline 최초 고정 — modetour/hanatour/ybtour 공통. */
export function computeBaselineAdultPriceOnUpsert(
  previous:
    | { adultPrice: number | null; baselineAdultPrice: number | null }
    | undefined,
  adultPrice: number | null,
): number | null {
  if (previous?.baselineAdultPrice != null) return previous.baselineAdultPrice
  if (previous && isValidUrgentDealPrice(previous.adultPrice)) return previous.adultPrice
  if (isValidUrgentDealPrice(adultPrice)) return adultPrice
  return null
}

export function isUrgentDealDeparture(
  row: UrgentDealDepartureRow,
  todayYmd: string,
  windowEndYmd: string,
): boolean {
  const ymd = departureDateToYmd(row.departureDate)
  if (ymd < todayYmd || ymd > windowEndYmd) return false
  if (!isValidUrgentDealPrice(row.baselineAdultPrice)) return false
  if (!isValidUrgentDealPrice(row.adultPrice)) return false
  return row.adultPrice < row.baselineAdultPrice
}

export function pickNearestUrgentDealDeparture(
  rows: UrgentDealDepartureRow[],
  todayYmd: string = kstTodayYmd(),
): UrgentDealNearest | null {
  const windowEndYmd = addDaysUtcYmd(todayYmd, SUPPLIER_URGENT_DEAL_WINDOW_DAYS)
  let best: UrgentDealNearest | null = null

  for (const row of rows) {
    if (!isUrgentDealDeparture(row, todayYmd, windowEndYmd)) continue
    const departureDateYmd = departureDateToYmd(row.departureDate)
    if (!best || departureDateYmd < best.departureDateYmd) {
      best = {
        departureDateYmd,
        baseline: row.baselineAdultPrice!,
        current: row.adultPrice!,
      }
    }
  }

  return best
}

export type SupplierUrgentDealSyncResult = {
  hasUrgentDeal: boolean
  turnedOn: boolean
  turnedOff: boolean
}

export async function syncSupplierUrgentDealForProduct(
  prisma: PrismaClient,
  productId: string,
  options?: { todayYmd?: string; now?: Date; previousHasUrgentDeal?: boolean | null },
): Promise<SupplierUrgentDealSyncResult> {
  const todayYmd = options?.todayYmd ?? kstTodayYmd()
  const windowEndYmd = addDaysUtcYmd(todayYmd, SUPPLIER_URGENT_DEAL_WINDOW_DAYS)
  const now = options?.now ?? new Date()

  const departures = await prisma.productDeparture.findMany({
    where: {
      productId,
      departureDate: {
        gte: ymdToUtcMidnight(todayYmd),
        lte: ymdToUtcMidnight(windowEndYmd),
      },
    },
    select: {
      departureDate: true,
      adultPrice: true,
      baselineAdultPrice: true,
    },
  })

  const nearest = pickNearestUrgentDealDeparture(departures, todayYmd)
  const hasUrgentDeal = nearest != null
  const urgentDealNextDate = nearest ? ymdToUtcMidnight(nearest.departureDateYmd) : null

  let previous = options?.previousHasUrgentDeal
  if (previous === undefined || previous === null) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { hasUrgentDeal: true },
    })
    previous = product?.hasUrgentDeal ?? false
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      hasUrgentDeal,
      urgentDealUpdatedAt: now,
      urgentDealNextDate,
    },
  })

  return {
    hasUrgentDeal,
    turnedOn: !previous && hasUrgentDeal,
    turnedOff: Boolean(previous) && !hasUrgentDeal,
  }
}
