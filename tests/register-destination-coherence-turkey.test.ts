import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDestinationCoherenceFieldIssues } from '../lib/register-destination-coherence'
import type { FlightStructured } from '../lib/detail-body-parser-types'
import { createEmptyFlightLeg } from '../lib/flight-parser-generic'

const istanbulFlight: FlightStructured = {
  airlineName: '대한항공',
  outbound: {
    ...createEmptyFlightLeg(),
    arrivalAirport: '이스탄불',
    departureAirport: '인천국제공항',
    flightNo: 'KE955',
  },
  inbound: {
    ...createEmptyFlightLeg(),
    departureAirport: '이스탄불',
    arrivalAirport: '인천국제공항',
    flightNo: 'KE956',
  },
  rawFlightLines: [],
  reviewNeeded: false,
  reviewReasons: [],
}

describe('register destination coherence — Turkey country vs Istanbul city', () => {
  it('skips info when representative is 튀르키예 and flight endpoints are 이스탄불', () => {
    const issues = buildDestinationCoherenceFieldIssues({
      representativeDestination: '튀르키예',
      schedule: [
        {
          day: 1,
          title: '인천 출발 — 이스탄불 도착',
          description: '튀르키예 입국 후 시내 관광',
        },
      ],
      flight: istanbulFlight,
    })
    assert.equal(
      issues.some((i) => i.field.startsWith('destination.representative_')),
      false,
      issues.map((i) => i.reason).join(' | ')
    )
  })
})
