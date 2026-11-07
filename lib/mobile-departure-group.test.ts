import { describe, expect, it } from 'vitest'
import {
  classifyMobileDepartureGroup,
  DEFAULT_MOBILE_DEPARTURE_PICK,
  mobileDeparturePickView,
  partitionByMobileDepartureGroup,
  selectMobileDepartureItems,
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

const PICK_FIXTURE = [
  { id: 'icn', mobileDepartureGroup: 'capital' as const },
  { id: 'gmp', mobileDepartureGroup: 'capital' as const },
  { id: 'pus', mobileDepartureGroup: 'regional' as const },
  { id: 'cju', mobileDepartureGroup: 'regional' as const },
  { id: 'blank', mobileDepartureGroup: null },
  { id: 'missing' },
]

describe('mobile departure pick', () => {
  it('default selection shows only 인천·김포', () => {
    expect(DEFAULT_MOBILE_DEPARTURE_PICK).toBe('capital')
    const view = mobileDeparturePickView(PICK_FIXTURE)
    expect(view.pick).toBe('capital')
    expect(view.shown.map((row) => row.id)).toEqual(['icn', 'gmp'])
    expect(view.empty).toBe(false)
    expect(view.shown.some((row) => row.id === 'blank' || row.id === 'missing' || row.id === 'pus')).toBe(
      false,
    )
  })

  it('switching to 지방 shows only regional departures', () => {
    const shown = selectMobileDepartureItems(PICK_FIXTURE, 'regional')
    expect(shown.map((row) => row.id)).toEqual(['pus', 'cju'])
    expect(mobileDeparturePickView(PICK_FIXTURE, 'regional').empty).toBe(false)
  })

  it('excludes unknown airports from both selections', () => {
    const capital = selectMobileDepartureItems(PICK_FIXTURE, 'capital').map((row) => row.id)
    const regional = selectMobileDepartureItems(PICK_FIXTURE, 'regional').map((row) => row.id)
    expect(capital).not.toContain('blank')
    expect(capital).not.toContain('missing')
    expect(regional).not.toContain('blank')
    expect(regional).not.toContain('missing')
    expect(mobileDeparturePickView(PICK_FIXTURE, 'capital').unknownCount).toBe(2)
    expect(mobileDeparturePickView(PICK_FIXTURE, 'regional').unknownCount).toBe(2)
  })

  it('empty-group state keeps the other group and unknown hidden', () => {
    const onlyRegional = PICK_FIXTURE.filter((row) => row.id === 'pus' || row.id === 'blank')
    const capitalView = mobileDeparturePickView(onlyRegional, 'capital')
    expect(capitalView.shown).toEqual([])
    expect(capitalView.empty).toBe(true)
    expect(capitalView.unknownCount).toBe(1)

    const onlyUnknown = [{ id: 'missing' }]
    expect(mobileDeparturePickView(onlyUnknown, 'capital').empty).toBe(true)
    expect(mobileDeparturePickView(onlyUnknown, 'regional').empty).toBe(true)
    expect(selectMobileDepartureItems(onlyUnknown, 'capital')).toEqual([])
    expect(selectMobileDepartureItems(onlyUnknown, 'regional')).toEqual([])
  })
})
