/**
 * 참좋은여행 전용: 본문에서 출발일은 알았으나 prices[]가 비어 ProductDeparture가 0건이 될 때 최소 1행 합성.
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'
import { parseDepartureDateTime, type DepartureInput } from '@/lib/upsert-product-departures-verygoodtour'

function combineDateTime(d: string | null | undefined, t: string | null | undefined): string | null {
  const dd = (d ?? '').replace(/\./g, '-').trim()
  const tt = (t ?? '').trim()
  if (!dd) return null
  if (!tt) return dd.length >= 10 ? dd.slice(0, 10) : null
  const isoish = `${dd.replace(/-/g, '.').slice(0, 10)} ${tt}`
  const dt = parseDepartureDateTime(isoish.replace(/\./g, '-'))
  return dt ? dt.toISOString() : null
}

export function verygoodBuildMinimalDepartureInputs(
  tripStartIso: string,
  parsed: RegisterParsed
): DepartureInput[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tripStartIso)) return []
  const fs = parsed.detailBodyStructured?.flightStructured
  const pt = parsed.productPriceTable
  const adult = pt?.adultPrice != null && Number.isFinite(Number(pt.adultPrice)) && Number(pt.adultPrice) > 0
    ? Math.round(Number(pt.adultPrice))
    : undefined
  const child =
    pt?.childExtraBedPrice != null && Number.isFinite(Number(pt.childExtraBedPrice)) && Number(pt.childExtraBedPrice) > 0
      ? Math.round(Number(pt.childExtraBedPrice))
      : undefined
  const infant =
    pt?.infantPrice != null && Number.isFinite(Number(pt.infantPrice)) && Number(pt.infantPrice) > 0
      ? Math.round(Number(pt.infantPrice))
      : undefined

  const ob = fs?.outbound
  const ib = fs?.inbound
  const outboundFlightNo = (parsed.outboundFlightNo ?? ob?.flightNo ?? '').trim() || undefined
  const inboundFlightNo = (parsed.inboundFlightNo ?? ib?.flightNo ?? '').trim() || undefined

  const row: DepartureInput = {
    departureDate: tripStartIso,
    ...(adult != null ? { adultPrice: adult } : {}),
    ...(child != null ? { childBedPrice: child } : {}),
    ...(infant != null ? { infantPrice: infant } : {}),
    carrierName: (parsed.airlineName ?? fs?.airlineName ?? '').trim() || undefined,
    outboundFlightNo,
    inboundFlightNo,
    outboundDepartureAirport: ob?.departureAirport?.trim() || undefined,
    outboundArrivalAirport: ob?.arrivalAirport?.trim() || undefined,
    outboundDepartureAt: combineDateTime(ob?.departureDate ?? null, ob?.departureTime ?? null),
    outboundArrivalAt: combineDateTime(ob?.arrivalDate ?? null, ob?.arrivalTime ?? null),
    inboundDepartureAirport: ib?.departureAirport?.trim() || undefined,
    inboundArrivalAirport: ib?.arrivalAirport?.trim() || undefined,
    inboundDepartureAt: combineDateTime(ib?.departureDate ?? null, ib?.departureTime ?? null),
    inboundArrivalAt: combineDateTime(ib?.arrivalDate ?? null, ib?.arrivalTime ?? null),
    statusRaw: parsed.departureStatusText?.trim() || undefined,
    seatsStatusRaw:
      parsed.currentBookedCount != null && parsed.minimumDepartureCount != null
        ? `예약 ${parsed.currentBookedCount} / 최소 ${parsed.minimumDepartureCount}`
        : undefined,
    minPax: parsed.minimumDepartureCount ?? undefined,
    reservationCount: parsed.currentBookedCount ?? undefined,
  }
  return [row]
}
