import { describe, expect, it, vi } from 'vitest'
import {
  MODETOUR_PARSER_AIRPORT_MAX,
  MODETOUR_PERSIST_AIRPORT_MAX,
  parseLegBodyFlexible,
  tryParseModetourFlightLines,
} from '@/lib/flight-modetour-parser'
import { capModetourLlmPriceField } from '@/lib/flight-modetour-parser'

describe('flight-modetour-parser jam caps', () => {
  it('parseLegBodyFlexible truncates oversized arrivalAirport from strict leg body', () => {
    const jam = '싱가포르 항공상세정보보기 여행도시 예약인원 상품가격 '.repeat(80)
    const body = `인천 2026.07.07(화) 19:20 → ${jam} 2026.07.10(금) 13:25 CZ6073`
    const leg = parseLegBodyFlexible(body)
    expect(leg).not.toBeNull()
    expect((leg!.arrivalAirport ?? '').length).toBeLessThanOrEqual(MODETOUR_PARSER_AIRPORT_MAX)
    expect((leg!.departureAirport ?? '').length).toBeLessThanOrEqual(MODETOUR_PARSER_AIRPORT_MAX)
  })

  it('parseLegBodyFlexible truncates loose leg jam between arrow and date', () => {
    const jam = '여행도시 싱가포르 예약인원 '.repeat(120)
    const body = `인천 → ${jam} 2026.07.10(금) 08:40 7C2624`
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const leg = parseLegBodyFlexible(body)
    warn.mockRestore()
    expect(leg).not.toBeNull()
    expect((leg!.arrivalAirport ?? '').length).toBeLessThanOrEqual(MODETOUR_PARSER_AIRPORT_MAX)
  })

  it('tryParseModetourFlightLines keeps deterministic legs under airport cap', () => {
    const jam = '연길 '.repeat(500)
    const lines = [
      '항공사: 중국남방항공',
      `출발 : 인천 2026.07.07(화) 19:20 → ${jam} 2026.07.07(화) 20:40 CZ6074`,
      '도착 : 연길 2026.07.10(금) 10:10 → 인천 2026.07.10(금) 13:25 CZ6073',
    ]
    const { result } = tryParseModetourFlightLines(lines, lines.join('\n'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.outbound.arrivalAirport ?? '').length).toBeLessThanOrEqual(MODETOUR_PARSER_AIRPORT_MAX)
      expect((result.inbound.arrivalAirport ?? '').length).toBeLessThanOrEqual(MODETOUR_PARSER_AIRPORT_MAX)
    }
  })
})

describe('capModetourLlmPriceField', () => {
  it('caps inboundArrivalAirport at persist max (120)', () => {
    const jam = '인천 2026.07.10(금) 08:40 7C2624 '.repeat(400)
    const capped = capModetourLlmPriceField('inboundArrivalAirport', jam)
    expect(capped).toBeDefined()
    expect(capped!.length).toBeLessThanOrEqual(MODETOUR_PERSIST_AIRPORT_MAX)
  })

  it('caps outboundFlightNo at 80', () => {
    const long = `${'7C2624'.repeat(30)}`
    const capped = capModetourLlmPriceField('outboundFlightNo', long)
    expect(capped!.length).toBeLessThanOrEqual(80)
  })
})
