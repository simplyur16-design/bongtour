/**
 * modetour 긴급모객 — baseline 대비 인하 출발일 판정·카드 payload SSOT.
 */
import type { PrismaClient } from '@prisma/client'

import { addDaysUtcYmd, kstTodayYmd } from '@/lib/product-sales-policy'

export const MODETOUR_URGENT_DEAL_WINDOW_DAYS = 30
export const MODETOUR_URGENT_DEAL_MIN_PRICE_KRW = 10_000

export type UrgentDealDepartureRow = {
  departureDate: Date
  adultPrice: number | null
  baselineAdultPrice: number | null
}

export type ModetourUrgentDealNearest = {
  departureDateYmd: string
  baseline: number
  current: number
}

export function isValidModetourUrgentDealPrice(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n >= MODETOUR_URGENT_DEAL_MIN_PRICE_KRW
}

export function departureDateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

export function isModetourUrgentDealDeparture(
  row: UrgentDealDepartureRow,
  todayYmd: string,
  windowEndYmd: string
): boolean {
  const ymd = departureDateToYmd(row.departureDate)
  if (ymd < todayYmd || ymd > windowEndYmd) return false
  if (!isValidModetourUrgentDealPrice(row.baselineAdultPrice)) return false
  if (!isValidModetourUrgentDealPrice(row.adultPrice)) return false
  return row.adultPrice < row.baselineAdultPrice
}

/** 인하 출발일 중 departureDate 가장 가까운(최소) 1건 — 카드·urgentDealNextDate SSOT */
export function pickNearestModetourUrgentDealDeparture(
  rows: UrgentDealDepartureRow[],
  todayYmd: string = kstTodayYmd()
): ModetourUrgentDealNearest | null {
  const windowEndYmd = addDaysUtcYmd(todayYmd, MODETOUR_URGENT_DEAL_WINDOW_DAYS)
  let best: ModetourUrgentDealNearest | null = null

  for (const row of rows) {
    if (!isModetourUrgentDealDeparture(row, todayYmd, windowEndYmd)) continue
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

export type ModetourUrgentDealSyncResult = {
  hasUrgentDeal: boolean
  turnedOn: boolean
  turnedOff: boolean
}

/**
 * sweep 성공 경로 — 30일 윈도우 평가 + hasUrgentDeal / urgentDealNextDate 캐시 갱신.
 * baseline SSOT: upsertProductDepartures (lib/upsert-product-departures-modetour.ts).
 */
export async function syncModetourUrgentDealForProduct(
  prisma: PrismaClient,
  productId: string,
  options?: { todayYmd?: string; now?: Date; previousHasUrgentDeal?: boolean | null }
): Promise<ModetourUrgentDealSyncResult> {
  const todayYmd = options?.todayYmd ?? kstTodayYmd()
  const windowEndYmd = addDaysUtcYmd(todayYmd, MODETOUR_URGENT_DEAL_WINDOW_DAYS)
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

  const nearest = pickNearestModetourUrgentDealDeparture(departures, todayYmd)
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
