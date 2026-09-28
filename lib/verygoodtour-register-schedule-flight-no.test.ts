import { describe, expect, it } from 'vitest'
import {
  buildVerygoodFlightStructuredFromDetailHtml,
  enrichVerygoodFlightNosFromScheduleText,
} from '@/lib/verygoodtour-register-api-detail'
import { createEmptyFlightLeg } from '@/lib/flight-parser-generic'

// REGRESSION-FREEZE[verygoodtour-register-schedule-flight-no]: 일정 시각↔편명 — manifest
describe('verygoodtour schedule flightNo SSOT', () => {
  it('matches 15:00 TW245 / 18:55 TW246 from itinerary departure lines', () => {
    const out = createEmptyFlightLeg()
    const inn = createEmptyFlightLeg()
    out.departureTime = '15:00'
    inn.departureTime = '18:55'
    const text = `
      15:00 TW245 인천국제공항 출발
      나리타 국제공항 이동
      18:55 TW246 나리타 국제공항 출발
    `
    const r = enrichVerygoodFlightNosFromScheduleText(out, inn, text)
    expect(r.outbound.flightNo).toBe('TW245')
    expect(r.inbound.flightNo).toBe('TW246')
  })

  it('buildVerygoodFlightStructuredFromDetailHtml fills flightNo from schedule when hero has none', () => {
    const html = `
      <div class="inout depature">
        한국출발 2026.10.21 (수) 15:00 인천 출발 2026.10.21 (수) 17:40 도쿄 도착
        한국도착 2026.10.24 (토) 18:55 도쿄 출발 2026.10.24 (토) 21:45 인천 도착
      </div>
      <div class="mb10"><p>15:00 TW245 인천국제공항 출발</p></div>
      <div class="mb10">18:55 TW246 나리타 국제공항 출발</div>
      <span class="airline">진에어</span>
    `
    const fs = buildVerygoodFlightStructuredFromDetailHtml(html)
    expect(fs).toBeTruthy()
    expect(fs?.outbound?.flightNo).toBe('TW245')
    expect(fs?.inbound?.flightNo).toBe('TW246')
  })
})
