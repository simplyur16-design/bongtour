/**
 * register-facts priceRows — DepartureInput·캘린더 행 → RegisterFactPriceRow SSOT.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: fact price row 매퍼 — manifest
 */
import type { KyowontourCalendarRow } from '@/lib/kyowontour-departures'
import type { LottetourCalendarRow } from '@/lib/lottetour-departures'
import type { RegisterFactPriceRow } from '@/lib/register-facts/types'
import type { RegisterDepartureLike } from '@/lib/register-departure-input-to-parsed-price'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'

function positiveInt(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

export function registerDepartureLikeToFactPriceRow(
  dep: RegisterDepartureLike & {
    supplierDepartureCode?: string | null
    childPrice?: number | null
    infantPrice?: number | null
  },
): RegisterFactPriceRow | null {
  const date = departureInputToYmd(dep.departureDate)
  if (!date || (dep.adultPrice ?? 0) <= 0) return null
  return {
    departureDate: date,
    adultPrice: dep.adultPrice ?? null,
    childPrice: dep.childBedPrice ?? dep.childPrice ?? null,
    infantPrice: dep.infantPrice ?? null,
    supplierDepartureCode: dep.supplierDepartureCode ?? null,
    statusRaw: dep.statusRaw?.trim() || null,
    seatsStatusRaw: dep.seatsStatusRaw?.trim() || null,
    seatCount: dep.seatCount ?? null,
    minPax: dep.minPax ?? null,
    carrierName: dep.carrierName?.trim() || null,
  }
}

export function kyowontourCalendarRowToFactPriceRow(row: KyowontourCalendarRow): RegisterFactPriceRow | null {
  if (!row.departDate || row.adultPriceFromCalendar <= 0) return null
  const raw = row.rawJson as Record<string, unknown>
  const statusRaw =
    row.status === 'soldout'
      ? '예약마감'
      : row.status === 'closed'
        ? '마감'
        : row.status === 'available'
          ? '예약가능'
          : String(raw.statusName ?? raw.reserveStatus ?? raw.rsvStatNm ?? '').trim() || null
  const seatCount = positiveInt(raw.remaSeatCnt ?? raw.remainSeat ?? raw.remainCnt ?? raw.seatCount)
  const minPax = positiveInt(
    raw.minDepartureCnt ?? raw.minPerson ?? raw.minCnt ?? raw.minimumDepartureNumberOfPeople ?? raw.minDepNop,
  )
  const seatsStatusRaw =
    seatCount != null ? `잔여${seatCount}석` : String(raw.seatsStatusRaw ?? raw.seatStatus ?? '').trim() || null
  return {
    departureDate: row.departDate,
    adultPrice: row.adultPriceFromCalendar,
    childPrice: null,
    infantPrice: null,
    supplierDepartureCode: row.tourCode || null,
    statusRaw,
    seatsStatusRaw,
    seatCount,
    minPax,
    carrierName: row.airline || null,
  }
}

export function lottetourCalendarRowToFactPriceRow(row: LottetourCalendarRow): RegisterFactPriceRow | null {
  if (!row.departDate || row.adultPrice <= 0) return null
  return {
    departureDate: row.departDate,
    adultPrice: row.adultPrice,
    childPrice: null,
    infantPrice: null,
    supplierDepartureCode: row.evtCd,
    statusRaw: row.statusRaw,
    seatsStatusRaw: row.seatsStatusRaw,
    seatCount: row.seatCount,
    minPax: null,
    carrierName: row.carrierText,
  }
}
