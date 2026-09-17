import { describe, expect, it } from 'vitest'
import {
  inferDepartureAirportFromHaystack,
  inferDepartureAirportFromRegisterFactFlights,
  inferHomeDepartureAirportFromFlightText,
  homeDepartureAirportDisplayText,
  parseHomeDepartureAirportLabel,
} from '@/lib/infer-home-departure-airport'

describe('inferHomeDepartureAirportFromFlightText', () => {
  it('returns null for incheon (default, no label)', () => {
    expect(inferHomeDepartureAirportFromFlightText('인천국제공항')).toBeNull()
    expect(inferHomeDepartureAirportFromFlightText('ICN')).toBeNull()
  })

  it('treats gimpo as seoul default (no label) and detects regional airports', () => {
    expect(inferHomeDepartureAirportFromFlightText('김포국제공항')).toBeNull()
    expect(parseHomeDepartureAirportLabel('gimpo')).toBeNull()
    expect(homeDepartureAirportDisplayText('gimpo')).toBeNull()
    expect(inferHomeDepartureAirportFromFlightText('부산')).toBe('busan')
    expect(inferHomeDepartureAirportFromFlightText('제주공항 출발')).toBe('jeju')
  })

  it('reads bracket and 출발 tags from listing titles', () => {
    // REGRESSION-FREEZE[register-pending-quality-keyword-desc-departure]: [부산] title — manifest
    expect(inferHomeDepartureAirportFromFlightText('[부산] 후쿠오카 1일 버스투어')).toBe('busan')
    expect(inferHomeDepartureAirportFromFlightText('대구출발 오사카 3일')).toBe('daegu')
    expect(inferHomeDepartureAirportFromFlightText('청주 출발 상해 4일')).toBe('cheongju')
    expect(inferHomeDepartureAirportFromFlightText('출발확정부산[TW] 오사카 3일')).toBe('busan')
  })

  it('ignores optional connect marketing, airport tax, and arrival-only jeju', () => {
    // REGRESSION-FREEZE[register-pending-local-departure-strong-signal]: weak connect / tax / arrival — manifest
    expect(inferHomeDepartureAirportFromFlightText('부산출발 내항기 연결 가능 (담당자 별도 문의)')).toBeNull()
    expect(
      inferHomeDepartureAirportFromFlightText('각종항공 TAX (전쟁보험료, 김해공항세, 관광진흥개발기금)'),
    ).toBeNull()
    expect(
      inferHomeDepartureAirportFromFlightText('제주국제공항 도착 후 용두암 해안도로를 따라 걷습니다'),
    ).toBeNull()
    expect(inferHomeDepartureAirportFromFlightText('제주공항')).toBeNull()
  })
})

describe('inferDepartureAirportFromHaystack', () => {
  it('does not tag busan from includedText connect marketing alone', () => {
    const meta = inferDepartureAirportFromHaystack(
      ['에미레이트항공', '스페인 클래식', '부산출발 내항기 연결 가능 (담당자 별도 문의)', '마드리드 공항'].join(
        '\n',
      ),
    )
    expect(meta.airportLabel).toBeNull()
    expect(meta.localDepartureTags).toEqual([])
  })

  it('keeps [부산] title even when schedule mentions Incheon', () => {
    const meta = inferDepartureAirportFromHaystack(
      ['[부산] 후쿠오카 1일 버스투어', '인천에서 출발해 후쿠오카에 도착합니다.'].join('\n'),
    )
    expect(meta.airportLabel).toBe('busan')
    expect(meta.localDepartureTags).toEqual(['busan'])
  })
})

describe('inferDepartureAirportFromRegisterFactFlights', () => {
  it('uses outbound departure city and sets localDepartureTag for busan', () => {
    const meta = inferDepartureAirportFromRegisterFactFlights([
      {
        direction: 'outbound',
        carrier: 'KE',
        flightNo: 'KE123',
        departureCity: '부산',
        departureAt: null,
        arrivalCity: '방콕',
        arrivalAt: null,
      },
    ])
    expect(meta.airportLabel).toBe('busan')
    expect(meta.localDepartureTags).toEqual(['busan'])
  })
})
