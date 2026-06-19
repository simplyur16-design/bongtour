import { describe, expect, it } from 'vitest'
import {
  hanatourProdInfoToDepartureInput,
  hanatourProdListRowToDepartureInput,
  hanatourYmdFromDepDay,
  isHanatourAirtelLikeProdInfo,
  parseHanatourPkgCdFromUrl,
} from '@/lib/hanatour-api-departures'

describe('hanatourYmdFromDepDay', () => {
  it('converts YYYYMMDD', () => {
    expect(hanatourYmdFromDepDay('20260706')).toBe('2026-07-06')
  })
})

describe('parseHanatourPkgCdFromUrl', () => {
  it('reads pkgCd from TRP url', () => {
    expect(
      parseHanatourPkgCdFromUrl(
        'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=AAB261260706FDB&type=H01',
      ),
    ).toBe('AAB261260706FDB')
  })
})

describe('isHanatourAirtelLikeProdInfo', () => {
  it('detects airtel attr', () => {
    expect(isHanatourAirtelLikeProdInfo({ prodAttrCd: 'B', frdmSchdDvCd: 'FS' })).toBe(true)
    expect(isHanatourAirtelLikeProdInfo({ prodAttrCd: 'P', frdmSchdDvCd: 'NS' })).toBe(false)
  })
})

describe('hanatourProdInfoToDepartureInput', () => {
  it('maps prod info to departure input', () => {
    const out = hanatourProdInfoToDepartureInput({
      saleProdCd: 'AAB261260706FDB',
      depDay: '20260706',
      adtTotlAmt: 799000,
    })
    expect(out?.departureDate).toBe('2026-07-06')
    expect(out?.adultPrice).toBe(799000)
    expect(out?.supplierDepartureCodeCandidate).toBe('hanatour:AAB261260706FDB')
  })
})

describe('hanatourProdListRowToDepartureInput', () => {
  it('maps prod list row with baf', () => {
    const out = hanatourProdListRowToDepartureInput({
      saleProdCd: 'ATP202260630LJX',
      depDay: '20260630',
      adtAmt: 719900,
      bafAmt: 162000,
    })
    expect(out?.departureDate).toBe('2026-06-30')
    expect(out?.adultPrice).toBe(881900)
  })
})
