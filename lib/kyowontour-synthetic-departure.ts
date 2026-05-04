/**
 * 교원이지 전용: prices[] 비어 있을 때 최소 ProductDeparture 1행 합성.
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
import { parseDepartureDateTime, type DepartureInput } from '@/lib/upsert-product-departures-kyowontour'

function combineDt(d: string | null | undefined, t: string | null | undefined): string | null {
  const dd = (d ?? '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\./g, '-').trim()
  const tt = (t ?? '').trim()
  if (!dd || !tt) return null
  const isoish = `${dd.slice(0, 10)} ${tt}`
  const dt = parseDepartureDateTime(isoish)
  return dt ? dt.toISOString() : null
}

export function kyowontourBuildMinimalDepartureInputs(
  tripStartIso: string,
  parsed: RegisterParsed,
  rawBlob?: string | null
): DepartureInput[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tripStartIso)) return []
  const fs = parsed.detailBodyStructured?.flightStructured
  const pt = parsed.productPriceTable
  const blob = rawBlob ?? ''
  const adult = pt?.adultPrice != null && Number(pt.adultPrice) > 0 ? Math.round(Number(pt.adultPrice)) : undefined
  const child =
    pt?.childExtraBedPrice != null && Number(pt.childExtraBedPrice) > 0
      ? Math.round(Number(pt.childExtraBedPrice))
      : undefined
  const infant = pt?.infantPrice != null && Number(pt.infantPrice) > 0 ? Math.round(Number(pt.infantPrice)) : undefined
  const ob = fs?.outbound
  const ib = fs?.inbound
  let remaining =
    parsed.remainingSeatsCount != null && Number.isFinite(parsed.remainingSeatsCount)
      ? Math.round(Number(parsed.remainingSeatsCount))
      : null
  if (remaining == null) {
    const m = blob.match(/(?:잔여\s*(\d+)\s*석|남은\s*좌석\s*[:：]?\s*(\d+)\s*석)/)
    if (m) remaining = parseInt(m[1] || m[2] || '', 10)
  }
  let reserved =
    parsed.currentBookedCount != null && Number.isFinite(parsed.currentBookedCount)
      ? Math.round(Number(parsed.currentBookedCount))
      : null
  if (reserved == null) {
    const m = blob.match(/현재\s*예약\s*[:：]?\s*(\d+)\s*명/)
    if (m) reserved = parseInt(m[1]!, 10)
  }
  const row: DepartureInput = {
    departureDate: tripStartIso,
    ...(adult != null ? { adultPrice: adult } : {}),
    ...(child != null ? { childBedPrice: child } : {}),
    ...(infant != null ? { infantPrice: infant } : {}),
    carrierName: (parsed.airlineName ?? fs?.airlineName ?? '').trim() || undefined,
    outboundFlightNo: (parsed.outboundFlightNo ?? ob?.flightNo ?? '').trim() || undefined,
    inboundFlightNo: (parsed.inboundFlightNo ?? ib?.flightNo ?? '').trim() || undefined,
    outboundDepartureAirport: ob?.departureAirport?.trim() || undefined,
    outboundArrivalAirport: ob?.arrivalAirport?.trim() || undefined,
    outboundDepartureAt: combineDt(ob?.departureDate ?? null, ob?.departureTime ?? null),
    outboundArrivalAt: combineDt(ob?.arrivalDate ?? null, ob?.arrivalTime ?? null),
    inboundDepartureAirport: ib?.departureAirport?.trim() || undefined,
    inboundArrivalAirport: ib?.arrivalAirport?.trim() || undefined,
    inboundDepartureAt: combineDt(ib?.departureDate ?? null, ib?.departureTime ?? null),
    inboundArrivalAt: combineDt(ib?.arrivalDate ?? null, ib?.arrivalTime ?? null),
    statusRaw: parsed.departureStatusText?.trim() || undefined,
    minPax: parsed.minimumDepartureCount ?? undefined,
    ...(reserved != null ? { reservationCount: reserved } : {}),
    ...(remaining != null ? { seatCount: remaining, seatsStatusRaw: `잔여${remaining}석` } : {}),
  }
  return [row]
}
