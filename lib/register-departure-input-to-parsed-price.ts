/**
 * 등록 confirm inject — DepartureInput → ParsedProductPrice (날짜·상태·좌석·항공사 SSOT).
 *
 * REGRESSION-FREEZE[register-facts-foundation]: departure→parsed price 메타 — manifest
 */
import { seatFieldsFromParsedCalendarPrice } from '@/lib/departure-seat-availability'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'

export type RegisterDepartureLike = {
  departureDate: string | Date
  adultPrice?: number | null
  childBedPrice?: number | null
  infantPrice?: number | null
  statusRaw?: string | null
  seatsStatusRaw?: string | null
  seatCount?: number | null
  minPax?: number | null
  carrierName?: string | null
  outboundFlightNo?: string | null
}

export function parsedProductStatusFromRaw(statusRaw?: string | null): ParsedProductPrice['status'] {
  const raw = String(statusRaw ?? '').trim()
  if (/출발\s*확정/.test(raw)) return '출발확정'
  if (/마감|매진|sold|closed|예약\s*마감|예약마감/i.test(raw)) return '마감'
  if (/대기/.test(raw)) return '대기예약'
  return '예약가능'
}

export function registerDepartureInputToParsedPrice(dep: RegisterDepartureLike): ParsedProductPrice | null {
  const date = departureInputToYmd(dep.departureDate)
  if (!date) return null
  const adultBase = dep.adultPrice ?? 0
  if (adultBase <= 0) return null

  const statusRaw = dep.statusRaw?.trim() || null
  const status = parsedProductStatusFromRaw(statusRaw)
  const seatFields = seatFieldsFromParsedCalendarPrice({
    availableSeats: dep.seatCount ?? undefined,
    seatsStatusRaw: dep.seatsStatusRaw,
    status: statusRaw ?? status,
  })

  const row: ParsedProductPrice = {
    date,
    adultBase,
    adultFuel: 0,
    childBedBase: dep.childBedPrice ?? undefined,
    childFuel: 0,
    infantBase: dep.infantPrice ?? undefined,
    infantFuel: 0,
    status,
    carrierName: dep.carrierName ?? null,
    outboundFlightNo: dep.outboundFlightNo ?? null,
    ...seatFields,
  }
  if (dep.minPax != null && dep.minPax > 0) row.minPax = dep.minPax
  if (dep.seatsStatusRaw?.trim()) row.seatsStatusRaw = dep.seatsStatusRaw.trim()
  return row
}

export function registerDepartureInputsToParsedPrices(deps: RegisterDepartureLike[]): ParsedProductPrice[] {
  return deps
    .map(registerDepartureInputToParsedPrice)
    .filter((row): row is ParsedProductPrice => row != null)
}
