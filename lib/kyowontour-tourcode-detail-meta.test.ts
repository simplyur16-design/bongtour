import { describe, expect, it } from 'vitest'

import {
  parseKyowontourThreeSlotPricesFromDetailHtml,
  parseKyowontourTourCodeDetailMetaFromHtml,
} from '@/lib/kyowontour-tourcode-detail-meta'
import { kyowontourCalendarRowToFactPriceRow } from '@/lib/register-fact-price-row'
import { mapKyowontourCalendarToDepartureInputs } from '@/lib/kyowontour-departures'
import type { KyowontourCalendarRow } from '@/lib/kyowontour-departures'

describe('parseKyowontourTourCodeDetailMetaFromHtml', () => {
  it('parses 예약인원·최소·max count from goodsEventDetail SSR', () => {
    const html = `
      <input type="hidden" id="statusId" value="3" />
      <div class="cell">예약 2명 (최소 출발 인원 4명)</div>
      function fn_reservation() { let count = Number("10"); }
    `
    const meta = parseKyowontourTourCodeDetailMetaFromHtml('MCP160260622WS01', html)
    expect(meta).toMatchObject({
      tourCode: 'MCP160260622WS01',
      reservationCount: 2,
      minPax: 4,
      maxPaxCount: 10,
      seatCount: 8,
      seatsStatusRaw: '잔여8석',
      statusId: 3,
      childPrice: null,
      infantPrice: null,
    })
  })

  // REGRESSION-FREEZE[kyowontour-tourcode-detail-meta]: hidden adult/child/infantPrice — manifest
  it('parses child/infant from hidden #childPrice #infantPrice (AVP024-like)', () => {
    const html = `
      <input type="hidden" id="statusId" value="8" />
      <div class="cell">예약 0명 (최소 출발 인원 4명)</div>
      function fn_reservation() { let count = Number("10"); }
      <input type="hidden" id="adultPrice" value="659000"/>
      <input type="hidden" id="childPrice" value="659000"/>
      <input type="hidden" id="infantPrice" value="150000"/>
    `
    expect(parseKyowontourThreeSlotPricesFromDetailHtml(html)).toEqual({
      adultPrice: 659000,
      childPrice: 659000,
      infantPrice: 150000,
    })
    const meta = parseKyowontourTourCodeDetailMetaFromHtml('AVP024260711VJ01', html)
    expect(meta?.childPrice).toBe(659000)
    expect(meta?.infantPrice).toBe(150000)
  })
})

describe('kyowontour calendar fact/map carries child/infant from detail rawJson', () => {
  it('maps enriched rawJson child/infant into DepartureInput', () => {
    const row: KyowontourCalendarRow = {
      departDate: '2026-07-11',
      returnDate: '2026-07-15',
      tourCode: 'AVP024260711VJ01',
      airline: 'VJ',
      adultPriceFromCalendar: 659000,
      status: 'available',
      rawJson: {
        adultPrice: 659000,
        childPrice: 659000,
        infantPrice: 150000,
        statusName: '예약가능',
      },
    }
    const fact = kyowontourCalendarRowToFactPriceRow(row)
    expect(fact).toMatchObject({
      adultPrice: 659000,
      childPrice: 659000,
      infantPrice: 150000,
    })
    const inputs = mapKyowontourCalendarToDepartureInputs([row], 'p1')
    expect(inputs[0]).toMatchObject({
      adultPrice: 659000,
      childBedPrice: 659000,
      infantPrice: 150000,
    })
  })
})
