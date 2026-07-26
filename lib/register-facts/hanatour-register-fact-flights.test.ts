/**
 * REGRESSION-FREEZE[register-detail-collect-flight-apply]: hanatour pkgAirSeqList → fact legs → structured
 * REGRESSION-FREEZE[hanatour-register-detail-collect]: pkgAirSeqList → fact flights — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterCollectedFlightStructured } from '@/lib/register-detail-collect-flight-apply'
import { buildHanatourFlightStructuredFromProdInfo } from '@/lib/hanatour-register-api-detail'
import {
  buildHanatourFlightStructuredFromFactLegs,
  hanatourProdInfoToFactFlightLegs,
} from '@/lib/register-facts/hanatour-register-fact-flights'

const sampleProdInfo = {
  depDay: '20260805',
  pkgAirSeqList: [
    {
      segSeq: '1',
      airlCd: '7C',
      airlNm: '제주항공',
      flgtNm: '2501',
      depHm: '0830',
      arrHm: '1155',
      depAptCd: 'ICN',
      depAptNm: '인천 국제공항',
      arrAptCd: 'CEB',
      arrAptNm: '세부 막탄 국제공항',
      depBassFlxbDt: '0',
      arrBassFlxbDt: '0',
    },
    {
      segSeq: '2',
      airlCd: '7C',
      airlNm: '제주항공',
      flgtNm: '2502',
      depHm: '1255',
      arrHm: '1820',
      depAptCd: 'CEB',
      depAptNm: '세부 막탄 국제공항',
      arrAptCd: 'ICN',
      arrAptNm: '인천 국제공항',
      depBassFlxbDt: '4',
      arrBassFlxbDt: '4',
    },
  ],
}

describe('hanatour register-fact flights (prefetch SSOT)', () => {
  it('pkgAirSeqList → fact legs → flightStructured with both flightNos', () => {
    const fromProd = buildHanatourFlightStructuredFromProdInfo(sampleProdInfo)
    expect(fromProd?.outbound.flightNo).toBe('7C2501')
    expect(fromProd?.inbound.flightNo).toBe('7C2502')

    const legs = hanatourProdInfoToFactFlightLegs(sampleProdInfo)
    expect(legs).toHaveLength(2)
    expect(legs.find((l) => l.direction === 'outbound')?.flightNo).toBe('7C2501')
    expect(legs.find((l) => l.direction === 'inbound')?.flightNo).toBe('7C2502')

    const fromLegs = buildHanatourFlightStructuredFromFactLegs(legs)
    expect(fromLegs?.airlineName).toContain('제주')
    expect(fromLegs?.outbound.flightNo).toBe('7C2501')
    expect(fromLegs?.inbound.flightNo).toBe('7C2502')
    expect(fromLegs?.debug?.status).toBe('success')

    const applied = applyRegisterCollectedFlightStructured(
      { originSource: 'hanatour' },
      fromLegs,
    )
    expect(applied.airlineName).toContain('제주')
    expect(applied.outboundFlightNo).toBe('7C2501')
    expect(applied.inboundFlightNo).toBe('7C2502')
    expect(applied.detailBodyStructured?.flightStructured?.outbound.flightNo).toBe('7C2501')
  })
})
