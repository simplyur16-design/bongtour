/**
 * Per-supplier fixture: status + 4 prices + flight fields → DepartureInput shape.
 * Live network not used — fixture objects only.
 */
import { describe, expect, it } from 'vitest'
import { hanatourProdListRowToDepartureInput } from '@/lib/hanatour-api-departures'
import { mapLottetourCalendarToDepartureInputs, parseLottetourEvtListAjaxHtml } from '@/lib/lottetour-departures'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'

function assertFourPricesAndStatus(input: DepartureInput, expectStatusSubstring: string) {
  expect(input.adultPrice).toBeGreaterThan(0)
  expect(input.statusRaw).toBeTruthy()
  expect(String(input.statusRaw)).toContain(expectStatusSubstring)
  // child/infant may be null when supplier omits a slot — never invent
  if (input.childBedPrice != null) expect(input.childBedPrice).toBeGreaterThan(0)
  if (input.childNoBedPrice != null) expect(input.childNoBedPrice).toBeGreaterThan(0)
  if (input.infantPrice != null) expect(input.infantPrice).toBeGreaterThan(0)
}

describe('supplier departure fixtures — status / prices / flight', () => {
  it('hanatour prod list row', () => {
    const out = hanatourProdListRowToDepartureInput({
      saleProdCd: 'ATP207260601TWJ',
      depDay: '20260601',
      adtAmt: 918900,
      chdAmt: 818900,
      infAmt: 120000,
      airlNm: '티웨이항공',
      depAirCd: 'TW',
      depFlgtCd: '0171',
      remaSeatCnt: 9,
      bkngStatCd: '2',
      minDepNop: 10,
    })
    expect(out).not.toBeNull()
    assertFourPricesAndStatus(out!, '예약')
    expect(out!.adultPrice).toBe(918900)
    expect(out!.childBedPrice).toBe(818900)
    expect(out!.infantPrice).toBe(120000)
    expect(out!.carrierName).toBe('티웨이항공')
    expect(out!.outboundFlightNo).toMatch(/TW/)
    expect(out!.statusRaw).toBe('예약가능')
    expect(out!.seatCount).toBe(9)
  })

  it('lottetour evtList HTML fixture (hochiminh sample)', () => {
    const html = `<!DOCTYPE html><html><body><table><tbody>
<tr>
  <td>05/13 (화) 18:50 / 05/18 (일) 22:10</td>
  <td>대한항공KE683</td>
  <td>품격</td>
  <td><a href="/evtDetail/826/857/1063/1067?evtCd=B28A260513KE003">호치민</a></td>
  <td>3박5일</td>
  <td><strong>1,290,000원</strong></td>
  <td>예약가능 잔여 5석</td>
</tr>
</tbody></table></body></html>`
    const { rows } = parseLottetourEvtListAjaxHtml(html, { depYm: '202605', godId: 'g1' })
    expect(rows.length).toBe(1)
    expect(rows[0]!.adultPrice).toBe(1_290_000)
    expect(rows[0]!.statusRaw).toBe('예약가능')
    expect(rows[0]!.departDate).toBe('2026-05-13')
    expect(rows[0]!.returnDate).toBe('2026-05-18')
    expect(rows[0]!.carrierText).toMatch(/대한항공|KE/)
    const inputs = mapLottetourCalendarToDepartureInputs(rows, 'prod-fixture')
    expect(inputs[0]!.adultPrice).toBe(1_290_000)
    expect(inputs[0]!.statusRaw).toBe('예약가능')
  })

  it('lottetour year rollover: return after New Year is not before departure', () => {
    const html = `<!DOCTYPE html><html><body><table><tbody>
<tr>
  <td>12/28 (월) 10:00 / 01/05 (월) 14:00</td>
  <td>티웨이항공TW001</td>
  <td>일반</td>
  <td><a href="/evtDetail/1/2/3/4?evtCd=B28A261228TW001">연말여행</a></td>
  <td>7박8일</td>
  <td><strong>999,000원</strong></td>
  <td>예약가능</td>
</tr>
</tbody></table></body></html>`
    const { rows } = parseLottetourEvtListAjaxHtml(html, { depYm: '202612', godId: 'g1' })
    expect(rows.length).toBe(1)
    expect(rows[0]!.departDate).toBe('2026-12-28')
    expect(rows[0]!.returnDate).toBe('2027-01-05')
    expect(rows[0]!.returnDate! > rows[0]!.departDate).toBe(true)
  })

  it('lottetour skips adult price dash and 마감; keeps 대기예약', () => {
    const html = `<!DOCTYPE html><html><body><table><tbody>
<tr>
  <td>05/13 (화) 18:50 / 05/18 (일) 22:10</td>
  <td>KE</td><td>일반</td>
  <td><a href="/evtDetail/1/2/3/4?evtCd=B28A260513KE001">A</a></td>
  <td>3박5일</td><td>-</td><td>예약가능</td>
</tr>
<tr>
  <td>05/14 (수) 18:50 / 05/19 (월) 22:10</td>
  <td>KE</td><td>일반</td>
  <td><a href="/evtDetail/1/2/3/4?evtCd=B28A260514KE001">B</a></td>
  <td>3박5일</td><td><strong>100,000원</strong></td><td>예약마감</td>
</tr>
<tr>
  <td>05/15 (목) 18:50 / 05/20 (화) 22:10</td>
  <td>KE</td><td>일반</td>
  <td><a href="/evtDetail/1/2/3/4?evtCd=B28A260515KE001">C</a></td>
  <td>3박5일</td><td><strong>200,000원</strong></td><td>예약가능</td>
</tr>
<tr>
  <td>05/16 (금) 18:50 / 05/21 (수) 22:10</td>
  <td>KE</td><td>일반</td>
  <td><a href="/evtDetail/1/2/3/4?evtCd=B28A260516KE001">D</a></td>
  <td>3박5일</td><td><strong>150,000원</strong></td><td>대기예약</td>
</tr>
</tbody></table></body></html>`
    const { rows } = parseLottetourEvtListAjaxHtml(html, { depYm: '202605', godId: 'g1' })
    expect(rows.map((r) => r.departDate)).toEqual(['2026-05-15', '2026-05-16'])
    const wait = rows.find((r) => r.departDate === '2026-05-16')
    expect(wait?.statusRaw).toBe('대기예약')
    expect(wait?.statusRaw).not.toBe('예약가능')
  })

  it('modetour-shaped DepartureInput fixture (status + 4 prices + flight)', () => {
    const input: DepartureInput = {
      departureDate: '2026-07-01',
      adultPrice: 1_100_000,
      childBedPrice: 1_100_000,
      childNoBedPrice: 990_000,
      infantPrice: 150_000,
      statusRaw: '예약가능',
      seatsStatusRaw: '잔여 8석',
      seatCount: 8,
      carrierName: '아시아나항공',
      outboundFlightNo: 'OZ750',
      outboundDepartureAirport: '인천',
      outboundDepartureAt: '2026-07-01T09:00:00+09:00',
      inboundFlightNo: 'OZ751',
      inboundArrivalAirport: '인천',
      inboundArrivalAt: '2026-07-05T18:00:00+09:00',
    }
    assertFourPricesAndStatus(input, '예약가능')
    expect(input.childNoBedPrice).toBe(990_000)
    expect(input.outboundFlightNo).toBe('OZ750')
  })

  it('ybtour-shaped DepartureInput fixture', () => {
    const input: DepartureInput = {
      departureDate: '2026-08-10',
      adultPrice: 2_490_000,
      childBedPrice: 2_190_000,
      childNoBedPrice: null,
      infantPrice: 200_000,
      statusRaw: '대기예약',
      seatsStatusRaw: null,
      carrierName: '대한항공',
      outboundFlightNo: 'KE907',
    }
    expect(input.statusRaw).toBe('대기예약')
    expect(input.adultPrice).toBe(2_490_000)
    expect(input.childBedPrice).toBe(2_190_000)
    expect(input.infantPrice).toBe(200_000)
    expect(input.outboundFlightNo).toBe('KE907')
  })

  it('verygoodtour-shaped DepartureInput fixture', () => {
    const input: DepartureInput = {
      departureDate: '2026-09-01',
      adultPrice: 899_000,
      childBedPrice: 799_000,
      childNoBedPrice: 699_000,
      infantPrice: 99_000,
      statusRaw: '출발확정',
      carrierName: '제주항공',
      outboundFlightNo: '7C2101',
    }
    expect(input.statusRaw).toBe('출발확정')
    expect([input.adultPrice, input.childBedPrice, input.childNoBedPrice, input.infantPrice]).toEqual([
      899_000, 799_000, 699_000, 99_000,
    ])
  })

  it('kyowontour-shaped DepartureInput fixture', () => {
    const input: DepartureInput = {
      departureDate: '2026-10-27',
      adultPrice: 5_899_000,
      childBedPrice: 5_399_000,
      childNoBedPrice: null,
      infantPrice: 500_000,
      statusRaw: '예약가능',
      carrierName: '대한항공',
      outboundFlightNo: 'KE913',
      outboundDepartureAt: '2026-10-27T09:55:00+09:00',
      inboundFlightNo: 'KE922',
      inboundDepartureAt: '2026-11-04T22:25:00+09:00',
    }
    expect(input.outboundFlightNo).toBe('KE913')
    expect(input.inboundFlightNo).toBe('KE922')
    expect(input.statusRaw).toBe('예약가능')
  })

  it('naeiltour-shaped DepartureInput fixture', () => {
    const input: DepartureInput = {
      departureDate: '2026-06-15',
      adultPrice: 450_000,
      childBedPrice: 400_000,
      childNoBedPrice: 350_000,
      infantPrice: 50_000,
      statusRaw: '예약가능',
      carrierName: '티웨이항공',
      outboundFlightNo: 'TW287',
    }
    expect(input.adultPrice).toBe(450_000)
    expect(input.statusRaw).toBe('예약가능')
    expect(input.outboundFlightNo).toBe('TW287')
  })
})
