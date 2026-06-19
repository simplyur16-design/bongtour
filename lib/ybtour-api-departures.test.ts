import { describe, expect, it } from 'vitest'
import {
  parseYbtourDepartureYmdFromEvCd,
  parseYbtourEvCdFromUrl,
  ybtourEventPriceToDepartureInput,
  ybtourYmdFromEvStartDt,
} from '@/lib/ybtour-api-departures'

describe('parseYbtourEvCdFromUrl', () => {
  it('reads evCd query param', () => {
    expect(
      parseYbtourEvCdFromUrl(
        'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&evCd=EEP1284-260703LO01',
      ),
    ).toBe('EEP1284-260703LO01')
  })
})

describe('parseYbtourDepartureYmdFromEvCd', () => {
  it('parses YYMMDD segment', () => {
    expect(parseYbtourDepartureYmdFromEvCd('EEP1284-260703LO01')).toBe('2026-07-03')
  })
})

describe('ybtourYmdFromEvStartDt', () => {
  it('normalizes YYYYMMDD', () => {
    expect(ybtourYmdFromEvStartDt('20260703')).toBe('2026-07-03')
  })
})

describe('ybtourEventPriceToDepartureInput', () => {
  it('sums adult price and fuel surcharge', () => {
    const input = ybtourEventPriceToDepartureInput(
      'EEP1284-260703LO01',
      { adtPrice: 2540000, bafAdtCost: 150000, chdPrice: 2621000, bafChdCost: 150000 },
      '2026-07-03',
    )
    expect(input?.adultPrice).toBe(2690000)
    expect(input?.childBedPrice).toBe(2771000)
    expect(input?.supplierDepartureCodeCandidate).toBe('ybtour:EEP1284-260703LO01')
  })
})
