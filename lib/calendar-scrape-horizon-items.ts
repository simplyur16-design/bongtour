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

type DepartureInputLike = {
  departureDate: string | Date | null
  adultPrice?: number | null
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

export function departureInputToCalendarScrapeItem(inp: DepartureInputLike): CalendarScrapeHorizonItem | null {
  const date = departureInputToYmd(inp.departureDate)
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
    outboundDepartureAt: inp.outboundDepartureAt ?? null,
    outboundArrivalAirport: inp.outboundArrivalAirport ?? null,
    outboundArrivalAt: inp.outboundArrivalAt ?? null,
    inboundFlightNo: inp.inboundFlightNo ?? null,
    inboundDepartureAirport: inp.inboundDepartureAirport ?? null,
    inboundDepartureAt: inp.inboundDepartureAt ?? null,
    inboundArrivalAirport: inp.inboundArrivalAirport ?? null,
    inboundArrivalAt: inp.inboundArrivalAt ?? null,
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
