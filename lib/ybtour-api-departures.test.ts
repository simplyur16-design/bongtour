import { describe, expect, it } from 'vitest'
import {
  normalizeYbtourGoodsCdForApi,
  parseYbtourDepartureYmdFromEvCd,
  parseYbtourEvCdFromUrl,
  parseYbtourGoodsCdFromUrl,
  parseYbtourBaseSeriesFromEvCdShape,
  pickYbtourSeedEvCdForByGoods,
  resolveYbtourByGoodsDspSid,
  resolveYbtourGoodsCdForApi,
  ybtourByGoodsRowToAdultPrice,
  ybtourByGoodsRowToDepartureInput,
  ybtourEventPriceToDepartureInput,
  ybtourGoodsCdLooksLikeEvCd,
  ybtourMonthKeysForYmdWindow,
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

describe('parseYbtourGoodsCdFromUrl', () => {
  it('reads goodsCd query param', () => {
    expect(
      parseYbtourGoodsCdFromUrl(
        'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&goodsCd=AVP4484&evCd=AVP4484-260711RS00',
      ),
    ).toBe('AVP4484')
  })
})

describe('normalizeYbtourGoodsCdForApi', () => {
  it('strips evCd-shaped goodsCd to series base', () => {
    expect(normalizeYbtourGoodsCdForApi('AVP4484-260711RS00', null)).toBe('AVP4484')
    expect(normalizeYbtourGoodsCdForApi('EEP1284-260703LO01', null)).toBe('EEP1284')
  })

  it('prefers clean originCode when URL goodsCd is evCd-shaped', () => {
    expect(normalizeYbtourGoodsCdForApi('AVP4484-260711RS00', 'AVP4484')).toBe('AVP4484')
  })

  it('keeps base goodsCd unchanged', () => {
    expect(normalizeYbtourGoodsCdForApi('EEP1284', 'EEP1284')).toBe('EEP1284')
  })
})

describe('resolveYbtourGoodsCdForApi', () => {
  it('derives base from evCd when goodsCd missing', () => {
    expect(
      resolveYbtourGoodsCdForApi(
        'https://prdt.ybtour.co.kr/product/detailPackage?evCd=EEP1284-260703LO01',
        'EEP1284',
      ),
    ).toBe('EEP1284')
  })

  it('normalizes evCd-shaped goodsCd in URL', () => {
    expect(
      resolveYbtourGoodsCdForApi(
        'https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=AVP4484-260711RS00&evCd=AVP4484-260711RS00',
        null,
      ),
    ).toBe('AVP4484')
  })
})

describe('pickYbtourSeedEvCdForByGoods', () => {
  it('prefers URL evCd when first-display dspSid resolves', () => {
    expect(
      pickYbtourSeedEvCdForByGoods({
        urlEvCd: 'AVP4484-260711RS00',
        dayEvCd: 'AVP4484-260621VJ02',
        urlEvCdDspSid: 'AABF011',
      }),
    ).toBe('AVP4484-260711RS00')
  })

  it('falls back to day evCd when URL evCd has no dspSid', () => {
    expect(
      pickYbtourSeedEvCdForByGoods({
        urlEvCd: 'ASP1072-260712TW00',
        dayEvCd: 'ASP1072-260701KE00',
        urlEvCdDspSid: null,
      }),
    ).toBe('ASP1072-260701KE00')
  })

  it('uses URL evCd when day is missing', () => {
    expect(
      pickYbtourSeedEvCdForByGoods({
        urlEvCd: 'EEP1284-260703LO01',
        dayEvCd: null,
        urlEvCdDspSid: null,
      }),
    ).toBe('EEP1284-260703LO01')
  })
})

describe('ybtourGoodsCdLooksLikeEvCd', () => {
  it('detects evCd suffix pattern', () => {
    expect(ybtourGoodsCdLooksLikeEvCd('AVP4484-260711RS00')).toBe(true)
    expect(ybtourGoodsCdLooksLikeEvCd('AVP4484')).toBe(false)
    expect(parseYbtourBaseSeriesFromEvCdShape('EEP1284-260703LO01')).toBe('EEP1284')
  })
})

describe('ybtourMonthKeysForYmdWindow', () => {
  it('lists YYYYMM keys across window', () => {
    expect(ybtourMonthKeysForYmdWindow('2026-06-20', '2026-08-05')).toEqual([
      '202606',
      '202607',
      '202608',
    ])
  })
})

describe('resolveYbtourByGoodsDspSid', () => {
  it('prefers dspSid4 over dspSid3', () => {
    expect(resolveYbtourByGoodsDspSid({ dspSid3: 'AABF000', dspSid4: 'AABF011' })).toBe('AABF011')
  })
})

describe('ybtourByGoodsRowToAdultPrice', () => {
  it('sums base fuel and tax', () => {
    expect(
      ybtourByGoodsRowToAdultPrice({ adtPrice: 719900, bafAdtPrice: 0, airTaxAdtPrice: 0 }),
    ).toBe(719900)
    expect(
      ybtourByGoodsRowToAdultPrice({ adtPrice: 100000, bafAdtPrice: 50000, airTaxAdtPrice: 10000 }),
    ).toBe(160000)
  })
})

describe('ybtourByGoodsRowToDepartureInput', () => {
  it('maps evCd row to departure input', () => {
    const input = ybtourByGoodsRowToDepartureInput({
      evCd: 'AVP4484-260621VJ02',
      outStartDt: '20260621',
      adtPrice: 719900,
      bafAdtPrice: 0,
      airTaxAdtPrice: 0,
      trCompanySnm: 'VJ',
    })
    expect(input?.departureDate).toBe('2026-06-21')
    expect(input?.adultPrice).toBe(719900)
    expect(input?.supplierDepartureCodeCandidate).toBe('ybtour:AVP4484-260621VJ02')
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
  it('sums adult price, fuel surcharge, and air tax', () => {
    const input = ybtourEventPriceToDepartureInput(
      'EEP1284-260703LO01',
      {
        adtPrice: 2540000,
        bafAdtCost: 150000,
        airTaxAdtCost: 50000,
        chdPrice: 2621000,
        bafChdCost: 150000,
        airTaxChdCost: 50000,
      },
      '2026-07-03',
    )
    expect(input?.adultPrice).toBe(2740000)
    expect(input?.childBedPrice).toBe(2821000)
    expect(input?.supplierDepartureCodeCandidate).toBe('ybtour:EEP1284-260703LO01')
  })
})
