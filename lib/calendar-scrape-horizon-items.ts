/**
 * DepartureInput → calendar-prices API item (배치·관리자 공통).
 *
 * REGRESSION-FREEZE[calendar-batch-api-first]: horizon item mapper — manifest
 */
import { departureInputToYmd } from '@/lib/scrape-date-bounds'

export type CalendarScrapeHorizonItem = {
  date: string
  price: number
  adultPrice: number
  statusRaw?: string | null
  seatsStatusRaw?: string | null
  minPax?: number | null
  carrierName?: string | null
  outboundFlightNo?: string | null
  outboundDepartureAirport?: string | null
  outboundDepartureAt?: string | null
  outboundArrivalAirport?: string | null
  outboundArrivalAt?: string | null
  inboundFlightNo?: string | null
  inboundDepartureAirport?: string | null
  inboundDepartureAt?: string | null
  inboundArrivalAirport?: string | null
  inboundArrivalAt?: string | null
  meetingInfoRaw?: string | null
  meetingPointRaw?: string | null
  meetingTerminalRaw?: string | null
  meetingGuideNoticeRaw?: string | null
}

type Dateish = string | Date | null | undefined

type DepartureInputLike = {
  departureDate: Dateish
  adultPrice?: number | null
  statusRaw?: string | null
  seatsStatusRaw?: string | null
  minPax?: number | null
  carrierName?: string | null
  outboundFlightNo?: string | null
  outboundDepartureAirport?: string | null
  outboundDepartureAt?: Dateish
  outboundArrivalAirport?: string | null
  outboundArrivalAt?: Dateish
  inboundFlightNo?: string | null
  inboundDepartureAirport?: string | null
  inboundDepartureAt?: Dateish
  inboundArrivalAirport?: string | null
  inboundArrivalAt?: Dateish
  meetingInfoRaw?: string | null
  meetingPointRaw?: string | null
  meetingTerminalRaw?: string | null
  meetingGuideNoticeRaw?: string | null
}

function dateishToIsoString(v: Dateish): string | null {
  if (v == null) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString()
  const s = String(v).trim()
  return s || null
}

export function departureInputToCalendarScrapeItem(inp: DepartureInputLike): CalendarScrapeHorizonItem | null {
  const date = inp.departureDate == null ? null : departureInputToYmd(inp.departureDate)
  if (!date) return null
  const price = inp.adultPrice != null ? Number(inp.adultPrice) : null
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  return {
    date,
    price,
    adultPrice: price,
    statusRaw: inp.statusRaw ?? inp.seatsStatusRaw ?? null,
    seatsStatusRaw: inp.seatsStatusRaw ?? null,
    minPax: inp.minPax ?? null,
    carrierName: inp.carrierName ?? null,
    outboundFlightNo: inp.outboundFlightNo ?? null,
    outboundDepartureAirport: inp.outboundDepartureAirport ?? null,
    outboundDepartureAt: dateishToIsoString(inp.outboundDepartureAt),
    outboundArrivalAirport: inp.outboundArrivalAirport ?? null,
    outboundArrivalAt: dateishToIsoString(inp.outboundArrivalAt),
    inboundFlightNo: inp.inboundFlightNo ?? null,
    inboundDepartureAirport: inp.inboundDepartureAirport ?? null,
    inboundDepartureAt: dateishToIsoString(inp.inboundDepartureAt),
    inboundArrivalAirport: inp.inboundArrivalAirport ?? null,
    inboundArrivalAt: dateishToIsoString(inp.inboundArrivalAt),
    meetingInfoRaw: inp.meetingInfoRaw ?? null,
    meetingPointRaw: inp.meetingPointRaw ?? null,
    meetingTerminalRaw: inp.meetingTerminalRaw ?? null,
    meetingGuideNoticeRaw: inp.meetingGuideNoticeRaw ?? null,
  }
}

export function mapDepartureInputsToCalendarScrapeItems(
  inputs: DepartureInputLike[],
): CalendarScrapeHorizonItem[] {
  return inputs
    .map(departureInputToCalendarScrapeItem)
    .filter((x): x is CalendarScrapeHorizonItem => x != null)
}
