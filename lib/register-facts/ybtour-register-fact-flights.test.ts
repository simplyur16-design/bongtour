/**
 * REGRESSION-FREEZE[ybtour-register-flight-from-fact-legs]
 */
import { describe, expect, it } from 'vitest'
import { buildYbtourFlightStructuredFromFactLegs } from '@/lib/register-facts/ybtour-register-fact-flights'
import { applyRegisterCollectedFlightStructured } from '@/lib/register-detail-collect-flight-apply'

describe('ybtour flight from fact legs', () => {
  it('builds flightStructured with airline + both flightNos from TM fact legs', () => {
    const fs = buildYbtourFlightStructuredFromFactLegs(
      [
        {
          direction: 'outbound',
          carrier: null,
          flightNo: 'OZ745',
          departureCity: '인천',
          departureAt: '2026-10-03T09:10',
          arrivalCity: '칭다오',
          arrivalAt: '2026-10-03T10:20',
        },
        {
          direction: 'inbound',
          carrier: null,
          flightNo: 'OZ746',
          departureCity: '칭다오',
          departureAt: '2026-10-06T11:30',
          arrivalCity: '인천',
          arrivalAt: '2026-10-06T14:00',
        },
      ],
      { airlineName: '아시아나항공' },
    )
    expect(fs?.airlineName).toBe('아시아나항공')
    expect(fs?.outbound.flightNo).toBe('OZ745')
    expect(fs?.inbound.flightNo).toBe('OZ746')
    expect(fs?.outbound.departureTime).toBe('09:10')
  })

  it('applyRegisterCollectedFlightStructured stamps flat + detailBodyStructured', () => {
    const fs = buildYbtourFlightStructuredFromFactLegs(
      [
        {
          direction: 'outbound',
          carrier: '대한항공',
          flightNo: 'KE023',
          departureCity: null,
          departureAt: '2026-10-09T08:00',
          arrivalCity: null,
          arrivalAt: null,
        },
        {
          direction: 'inbound',
          carrier: '대한항공',
          flightNo: 'KE054',
          departureCity: null,
          departureAt: '2026-10-19T15:00',
          arrivalCity: null,
          arrivalAt: null,
        },
      ],
      { airlineName: '대한항공' },
    )
    const applied = applyRegisterCollectedFlightStructured({}, fs)
    expect(applied.airlineName).toBe('대한항공')
    expect(applied.outboundFlightNo).toBe('KE023')
    expect(applied.inboundFlightNo).toBe('KE054')
    expect(applied.detailBodyStructured?.flightStructured?.outbound.flightNo).toBe('KE023')
  })
})
