import { describe, expect, it } from 'vitest'
import {
  departureInputToCalendarScrapeItem,
  mapDepartureInputsToCalendarScrapeItems,
} from '@/lib/calendar-scrape-horizon-items'

describe('calendar-scrape-horizon-items', () => {
  it('maps priced departure to calendar item', () => {
    const item = departureInputToCalendarScrapeItem({
      departureDate: '2026-07-15',
      adultPrice: 1290000,
      statusRaw: '예약가능',
      outboundFlightNo: 'OZ123',
    })
    expect(item).toEqual({
      date: '2026-07-15',
      price: 1290000,
      adultPrice: 1290000,
      statusRaw: '예약가능',
      seatsStatusRaw: null,
      minPax: null,
      carrierName: null,
      outboundFlightNo: 'OZ123',
      outboundDepartureAirport: null,
      outboundDepartureAt: null,
      outboundArrivalAirport: null,
      outboundArrivalAt: null,
      inboundFlightNo: null,
      inboundDepartureAirport: null,
      inboundDepartureAt: null,
      inboundArrivalAirport: null,
      inboundArrivalAt: null,
      meetingInfoRaw: null,
      meetingPointRaw: null,
      meetingTerminalRaw: null,
      meetingGuideNoticeRaw: null,
    })
  })

  it('drops zero or missing price', () => {
    expect(
      departureInputToCalendarScrapeItem({ departureDate: '2026-07-15', adultPrice: 0 }),
    ).toBeNull()
    expect(departureInputToCalendarScrapeItem({ departureDate: '2026-07-15' })).toBeNull()
  })

  it('maps list', () => {
    const items = mapDepartureInputsToCalendarScrapeItems([
      { departureDate: '2026-07-15', adultPrice: 100 },
      { departureDate: '2026-07-16', adultPrice: 0 },
    ])
    expect(items).toHaveLength(1)
    expect(items[0]?.date).toBe('2026-07-15')
  })
})
