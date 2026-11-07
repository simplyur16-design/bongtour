import { describe, expect, it } from 'vitest'
import {
  classifyMobileDepartureGroup,
  partitionByMobileDepartureGroup,
} from '@/lib/mobile-departure-group'

describe('classifyMobileDepartureGroup', () => {
  it('puts explicit ICN and GMP in the capital group', () => {
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: 'ICN' })).toBe('capital')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '인천' })).toBe('capital')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '인천국제공항' })).toBe('capital')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: 'GMP' })).toBe('capital')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '김포' })).toBe('capital')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '김포국제공항' })).toBe('capital')
    expect(classifyMobileDepartureGroup({ departureAirportLabel: 'gimpo' })).toBe('capital')
  })

  it('puts 청주·대구·부산(김해)·제주 in the regional group', () => {
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '청주국제공항' })).toBe('regional')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: 'CJJ' })).toBe('regional')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '대구공항' })).toBe('regional')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: 'TAE' })).toBe('regional')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '부산' })).toBe('regional')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '김해국제공항' })).toBe('regional')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: 'PUS' })).toBe('regional')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '제주공항' })).toBe('regional')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: 'CJU' })).toBe('regional')
    expect(classifyMobileDepartureGroup({ departureAirportLabel: 'busan' })).toBe('regional')
    expect(classifyMobileDepartureGroup({ localDepartureTags: ['jeju'] })).toBe('regional')
  })

  it('does not treat a missing or unknown airport as 인천', () => {
    // REGRESSION-FREEZE[mobile-departure-group-actual-airport]: missing airport is unknown — manifest
    expect(classifyMobileDepartureGroup({})).toBe('unknown')
    expect(classifyMobileDepartureGroup({ departureAirportLabel: null, localDepartureTags: [] })).toBe('unknown')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '' })).toBe('unknown')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: 'NRT' })).toBe('unknown')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '방콕' })).toBe('unknown')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '[부산] 후쿠오카 1일' })).toBe('unknown')
    expect(classifyMobileDepartureGroup({ outboundDepartureAirport: '부산출발 내항기 연결 가능' })).toBe('unknown')
    expect(
      classifyMobileDepartureGroup({
        outboundDepartureAirport: 'NRT',
        departureAirportLabel: 'busan',
        localDepartureTags: ['busan'],
      }),
    ).toBe('unknown')
  })

  it('prefers the departure row airport over a stored regional tag', () => {
    expect(
      classifyMobileDepartureGroup({
        outboundDepartureAirport: '인천국제공항',
        localDepartureTags: ['busan'],
      }),
    ).toBe('capital')
  })
})

describe('partitionByMobileDepartureGroup', () => {
  it('keeps a missing group field out of 인천·김포', () => {
    const parts = partitionByMobileDepartureGroup([
      { id: 'a', mobileDepartureGroup: 'capital' as const },
      { id: 'b', mobileDepartureGroup: 'regional' as const },
      { id: 'c' },
      { id: 'd', mobileDepartureGroup: null },
    ])
    expect(parts.capital.map((x) => x.id)).toEqual(['a'])
    expect(parts.regional.map((x) => x.id)).toEqual(['b'])
    expect(parts.unknown.map((x) => x.id)).toEqual(['c', 'd'])
  })
})
