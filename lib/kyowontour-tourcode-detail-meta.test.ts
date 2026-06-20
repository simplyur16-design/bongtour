import { describe, expect, it } from 'vitest'

import { parseKyowontourTourCodeDetailMetaFromHtml } from '@/lib/kyowontour-tourcode-detail-meta'

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
    })
  })
})
