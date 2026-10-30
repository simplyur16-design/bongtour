import { describe, expect, it } from 'vitest'
import {
  iataFromSupplierAirlineName,
  iataPrefixFromFlightNo,
  resolveDepartureRowAirlineForDisplay,
  resolveProductAirlineFromDeparturesForDisplay,
} from '@/lib/departure-airline-display'
import { departureCarrierPublicLabel } from '@/lib/airline-variant-group'
import { formatPublicAirlineDisplay, canonicalizePublicAirlineKo } from '@/lib/airline-iata-public-display-ssot'

describe('편명 IATA 접두', () => {
  it('형식', () => {
    expect(iataPrefixFromFlightNo('AF267')).toBe('AF')
    expect(iataPrefixFromFlightNo('7C 2503')).toBe('7C')
    expect(iataPrefixFromFlightNo('VZ0851')).toBe('VZ')
    expect(iataPrefixFromFlightNo('대한항공')).toBeNull()
  })
  it('공급사 이름 → 코드', () => {
    expect(iataFromSupplierAirlineName('카타르')).toBe('QR')
    expect(iataFromSupplierAirlineName('트리니티항공(구)티웨이항공')).toBe('TW')
    expect(iataFromSupplierAirlineName('외탄야경 중국남방항공')).toBe('CZ')
    expect(iataFromSupplierAirlineName('파라타 항공')).toBe('WE')
  })
})

describe('출발 회차 항공사 (표시 전용)', () => {
  it("원문 '카타르' + AF267/AF264 → 에어프랑스", () => {
    expect(resolveDepartureRowAirlineForDisplay({ carrierName: '카타르', outboundFlightNo: 'AF267', inboundFlightNo: 'AF264' })).toBe('에어프랑스')
  })
  it("mt-0064: 원문 '에어부산' + YP151 → 에어프레미아", () => {
    expect(resolveDepartureRowAirlineForDisplay({ carrierName: '에어부산', outboundFlightNo: 'YP151', inboundFlightNo: 'YP152' })).toBe('에어프레미아')
  })
  it('이름 코드가 오는편과 같으면 원문 유지 (KE951 / EK773 + 에미레이트)', () => {
    expect(resolveDepartureRowAirlineForDisplay({ carrierName: '에미레이트 항공', outboundFlightNo: 'KE951', inboundFlightNo: 'EK773' })).toBe('에미레이트 항공')
  })
  it('공동운항: EK 편명 + 에미레이트 원문은 그대로 (pkg-vg-0060)', () => {
    expect(resolveDepartureRowAirlineForDisplay({ carrierName: '에미레이트항공', outboundFlightNo: 'EK2198' })).toBe('에미레이트항공')
  })
  it('편명 없으면 원문 그대로, 원문 없거나 깨지면 편명', () => {
    expect(resolveDepartureRowAirlineForDisplay({ carrierName: '라탐항공' })).toBe('라탐항공')
    expect(resolveDepartureRowAirlineForDisplay({ carrierName: '', outboundFlightNo: 'HX627' })).toBe('홍콩항공')
    expect(resolveDepartureRowAirlineForDisplay({ carrierName: '\uFFFD\uFFFD항공', outboundFlightNo: 'CA124' })).toBe('중국국제항공')
    expect(resolveDepartureRowAirlineForDisplay({ carrierName: '미표기' })).toBeNull()
  })
  it('카드 항공사 라벨도 같은 규칙', () => {
    expect(departureCarrierPublicLabel({ carrierName: '카타르', outboundFlightNo: 'AF267' })).toBe('에어프랑스')
    expect(departureCarrierPublicLabel({ carrierName: '홍콩에어라인' })).toBe('홍콩항공')
  })
})

describe('대표 항공사 = 출발 회차 집계 (Product.airline 원문 유지)', () => {
  it('회차 1개 항공사면 그 항공사 (fit-hn-0026 파라타 → 에어부산)', () => {
    const deps = Array.from({ length: 7 }, () => ({ carrierName: '에어부산', outboundFlightNo: 'BX0111' }))
    expect(resolveProductAirlineFromDeparturesForDisplay('파라타 항공', deps)).toBe('에어부산')
  })
  it('참좋은여행 기본값 진에어 + 회차 전부 티웨이 → 트리니티항공', () => {
    const deps = [{ carrierName: '티웨이항공' }, { carrierName: '' }, { carrierName: '티웨이항공' }]
    expect(resolveProductAirlineFromDeparturesForDisplay('진에어', deps)).toBe('트리니티항공')
  })
  it('여러 항공사: 대표가 최다면 유지, 아니면 "최다 외 N개 항공사"', () => {
    const deps = [
      { carrierName: '아시아나항공' }, { carrierName: '아시아나항공' }, { carrierName: '에어프레미아' },
    ]
    expect(resolveProductAirlineFromDeparturesForDisplay('아시아나항공', deps)).toBe('아시아나항공')
    expect(resolveProductAirlineFromDeparturesForDisplay('대한항공', deps)).toBe('아시아나항공 외 1개 항공사')
  })
  it('회차 항공사 정보가 없으면 Product.airline', () => {
    expect(resolveProductAirlineFromDeparturesForDisplay('대한항공', [{ carrierName: null }])).toBe('대한항공')
    expect(resolveProductAirlineFromDeparturesForDisplay(null, [])).toBeNull()
  })
})

describe('HX 홍콩항공 (사장님 10/31 07:25, 표시 전용)', () => {
  it('홍콩에어라인 → 홍콩항공, HX → 홍콩항공', () => {
    expect(formatPublicAirlineDisplay('홍콩에어라인')).toBe('홍콩항공')
    expect(formatPublicAirlineDisplay('HX')).toBe('홍콩항공')
    expect(formatPublicAirlineDisplay('HX627')).toBe('홍콩항공')
    expect(formatPublicAirlineDisplay('홍콩익스프레스')).toBe('홍콩익스프레스')
  })
  it('저장 경로(canonicalizePublicAirlineKo)는 원문 유지', () => {
    expect(canonicalizePublicAirlineKo('홍콩에어라인')).toBe('홍콩에어라인')
  })
})
