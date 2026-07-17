import { describe, expect, it } from 'vitest'

import {
  buildKyowontourFlightStructuredFromDetailHtml,
  extractKyowontourProductTitleFromDetailHtml,
  parseKyowontourRemainingSeatsFromDetailHtml,
  parseKyowontourTrafficDateTimeToken,
} from '@/lib/kyowontour-register-api-detail'

const ECP102_TRAFFIC_HTML = `
<div class="tit"><strong>이용교통</strong><p class="area"><span class="txt">아시아나항공</span></p></div>
<dl><dt>한국출발</dt><dd>2026년 06월 27일 (토) 10:25<span class="label-state in traffic">OZ551</span></dd></dl>
<dl><dt>현지출발</dt><dd>2026년 07월 04일 (토) 17:55<span class="label-state in traffic">OZ552</span></dd></dl>
<dl><dt>현지도착</dt><dd>2026년 06월 27일 (토) 16:10<span class="label-state in traffic">OZ551</span></dd></dl>
<dl><dt>한국도착</dt><dd>2026년 07월 05일 (일) 09:45<span class="label-state in traffic">OZ552</span></dd></dl>
`

describe('kyowontour register api detail HTML extract', () => {
  it('parseKyowontourTrafficDateTimeToken parses Korean datetime + flightNo', () => {
    const parsed = parseKyowontourTrafficDateTimeToken('2026년 06월 27일 (토) 10:25 OZ551')
    expect(parsed).toMatchObject({
      departureDate: '2026-06-27 (토)',
      departureTime: '10:25',
      flightNo: 'OZ551',
    })
  })

  it('extractKyowontourProductTitleFromDetailHtml prefers tourTitle JS var', () => {
    const html = `const tourTitle = '★출발확정★튀르키예 일주 9일 [여행의 정석] #아시아나항공 HIT';`
    expect(extractKyowontourProductTitleFromDetailHtml(html)).toContain('튀르키예')
  })

  it('decodes HTML entities in tourTitle (&amp; → &)', () => {
    const html = `const tourTitle = '[하노이&amp;하롱베이5일] #VJ961 #노옵션 HIT';`
    expect(extractKyowontourProductTitleFromDetailHtml(html)).toBe(
      '[하노이&하롱베이5일] #VJ961 #노옵션 HIT',
    )
  })

  it('parseKyowontourRemainingSeatsFromDetailHtml reads 남은 좌석 em markup', () => {
    const html = `예약<em class="color-point-red">19</em>명( 남은 좌석<em class="color-point-red">12</em>석 / 최소 출발인원 <em>20</em>명)`
    expect(parseKyowontourRemainingSeatsFromDetailHtml(html)).toMatchObject({
      remainingSeatsCount: 12,
      currentBookedCount: 19,
      minimumDepartureCount: 20,
      seatsStatusRaw: '잔여12석',
    })
  })

  it('buildKyowontourFlightStructuredFromDetailHtml builds OZ551/OZ552 legs', () => {
    const fs = buildKyowontourFlightStructuredFromDetailHtml(ECP102_TRAFFIC_HTML)
    expect(fs?.airlineName).toBe('아시아나항공')
    expect(fs?.outbound.flightNo).toBe('OZ551')
    expect(fs?.inbound.flightNo).toBe('OZ552')
    expect(fs?.outbound.departureTime).toBe('10:25')
    expect(fs?.inbound.departureTime).toBe('17:55')
    expect(fs?.inbound.arrivalTime).toBe('09:45')
    expect(fs?.debug?.status).toBe('success')
  })
})
