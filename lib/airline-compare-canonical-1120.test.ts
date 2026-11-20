import { describe, expect, it } from 'vitest'
import { airlineFacetBuckets, airlinePartsMatchCode } from '@/lib/airline-catalog'
import {
  airlineLabelFromParam,
  airlineParamForLabel,
  canonicalPublicAirlineLabel,
  departureCarrierPublicLabel,
} from '@/lib/airline-variant-group'
import { resolveProductAirlineFromDeparturesForDisplay } from '@/lib/departure-airline-display'
import { aggregateAirlineFacets } from '@/lib/products-browse-facets'
import type { ProductBrowseFullRow } from '@/lib/products-browse-extended-filter'
import { deriveAirlineFact } from '@/lib/supplier-product-fact-ssot'

function row(airline: string | null, carriers: string[]): ProductBrowseFullRow {
  return {
    airline,
    departures: carriers.map((carrierName) => ({ carrierName })),
  } as ProductBrowseFullRow
}

describe('항공사 비교 — 고정 테이블로 같은 이름', () => {
  it('띄어쓴 공급사 원문은 표의 한글명 하나로 모은다', () => {
    expect(canonicalPublicAirlineLabel('중국 동방 항공')).toBe('중국동방항공')
    expect(canonicalPublicAirlineLabel('에티하드 항공')).toBe('에티하드항공')
    expect(canonicalPublicAirlineLabel('에어로케이 항공')).toBe('에어로케이')
    expect(canonicalPublicAirlineLabel('산동 항공')).toBe('산동항공')
    expect(canonicalPublicAirlineLabel('타이 에어아시아')).toBe('타이 에어아시아')
    expect(departureCarrierPublicLabel({ carrierName: '중국 동방 항공', outboundFlightNo: 'MU5054' })).toBe('중국동방항공')
  })

  it('코드와 이름이 같은 옵션이 된다. 표에 없는 코드는 만들지 않는다', () => {
    expect(airlineLabelFromParam('SC')).toBe('산동항공')
    expect(airlineLabelFromParam('3U')).toBe('사천항공')
    expect(airlineLabelFromParam('산동항공')).toBe('산동항공')
    expect(airlineLabelFromParam('ZZ')).toBeNull()
    expect(airlineParamForLabel('에어아시아')).toBe('에어아시아')
  })

  it('가는 편과 오는 편 코드가 다르고 원문이 오는 편과 같으면 원문 항공사를 유지한다', () => {
    expect(
      departureCarrierPublicLabel({
        carrierName: '에미레이트 항공',
        outboundFlightNo: 'KE951',
        inboundFlightNo: 'EK773',
      }),
    ).toBe('에미레이트항공')
  })

  it('비교표 항공사도 같은 표기', () => {
    expect(deriveAirlineFact({ departureKeyFactsAirline: '중국 동방 항공' }).airlineLabel).toBe('중국동방항공')
    expect(deriveAirlineFact({ departureKeyFactsAirline: 'KE' }).airlineLabel).toBe('대한항공')
    expect(deriveAirlineFact({ departureKeyFactsAirline: '제주에어' }).airlineLabel).toBe('제주항공')
  })

  it('대표 문구는 표의 이름. 원문 Product.airline 조기 반환은 유지', () => {
    const deps = [
      { carrierName: '에티하드 항공', outboundFlightNo: 'EY0823' },
      { carrierName: '에티하드 항공', outboundFlightNo: 'EY0823' },
      { carrierName: '에미레이트항공', outboundFlightNo: 'EK0323' },
    ]
    expect(resolveProductAirlineFromDeparturesForDisplay(null, deps)).toBe('에티하드항공 외 1개 항공사')
    expect(resolveProductAirlineFromDeparturesForDisplay('트리니티항공(구)티웨이항공', [
      { carrierName: '트리니티항공(구)티웨이항공', outboundFlightNo: 'TW0029' },
      { carrierName: '트리니티항공(구)티웨이항공', outboundFlightNo: 'TW0029' },
    ])).toBe('트리니티항공(구)티웨이항공')
  })

  it('목록 필터: 제주에어는 제주항공, 표 밖 항공사는 기타가 아니라 이름별', () => {
    const facets = aggregateAirlineFacets([
      row(null, ['제주에어']),
      row(null, ['중국 동방 항공']),
      row('대한항공', ['대한항공', '제주항공']),
      row(null, ['선박']),
    ])
    const by = Object.fromEntries(facets.map((f) => [f.code, f.count]))
    expect(by['jeju-air']).toBe(2)
    expect(by['korean-air']).toBe(1)
    expect(by['중국동방항공']).toBe(1)
    expect(by.other).toBe(1)
    expect(facets.find((f) => f.code === '중국동방항공')?.label).toBe('중국동방항공')
    expect(airlineFacetBuckets(['에어로케이 항공']).map((b) => b.code)).toEqual(['airok'])
    expect(airlinePartsMatchCode(['중국 동방 항공'], '중국동방항공')).toBe(true)
    expect(airlinePartsMatchCode(['중국 동방 항공'], 'other')).toBe(false)
    expect(airlinePartsMatchCode(['선박'], 'other')).toBe(true)
  })
})
