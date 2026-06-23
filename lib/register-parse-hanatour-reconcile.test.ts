/**
 * REGRESSION-FREEZE[hanatour-register-samples-live-gate]: pkgAirSeqList 후 extractionFieldIssues 재동기화
 */
import { describe, expect, it } from 'vitest'
import { buildHanatourFlightStructuredFromProdInfo } from '@/lib/hanatour-register-api-detail'
import { refreshHanatourDetailBodyPolicy, reconcileHanatourExtractionFieldIssuesAfterDetailBodyPatch } from '@/lib/register-parse-hanatour'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import { parseFlightSectionHanatour } from '@/lib/flight-parser-hanatour'

describe('reconcileHanatourExtractionFieldIssuesAfterDetailBodyPatch', () => {
  it('pkgAirSeqList 성공 후 항공 [REVIEW REQUIRED] 잔여 제거', () => {
    const failedFlight = parseFlightSectionHanatour('', null)
    const apiFlight = buildHanatourFlightStructuredFromProdInfo({
      depDay: '20260628',
      pkgAirSeqList: [
        {
          segSeq: '1',
          airlCd: 'TW',
          airlNm: '티웨이',
          flgtNm: '0643',
          depHm: '0920',
          arrHm: '1330',
          depAptCd: 'ICN',
          depAptNm: '인천',
          arrAptCd: 'NRT',
          arrAptNm: '나리타',
          depBassFlxbDt: '0',
          arrBassFlxbDt: '0',
        },
        {
          segSeq: '2',
          airlCd: 'TW',
          airlNm: '티웨이',
          flgtNm: '0644',
          depHm: '1500',
          arrHm: '1830',
          depAptCd: 'NRT',
          depAptNm: '나리타',
          arrAptCd: 'ICN',
          arrAptNm: '인천',
          depBassFlxbDt: '4',
          arrBassFlxbDt: '4',
        },
      ],
    })
    expect(apiFlight?.debug?.status).toBe('success')

    const baseDetail = refreshHanatourDetailBodyPolicy({
      sections: [
        { type: 'schedule_section', text: '1일차 일정' },
        { type: 'summary_section', text: '요약' },
      ],
      raw: {},
      normalizedRaw: '',
      flightStructured: failedFlight,
      hotelStructured: { rows: [], reviewNeeded: false, reviewReasons: [] },
      optionalToursStructured: { rows: [], reviewNeeded: false, reviewReasons: [] },
      shoppingStructured: { rows: [], reviewNeeded: false, reviewReasons: [] },
      includedExcludedStructured: { rows: [], reviewNeeded: false, reviewReasons: [] },
      review: { required: [], warning: [], info: [] },
      sectionReview: {
        flight_section: { required: failedFlight.reviewReasons, warning: [], info: [] },
        hotel_section: { required: [], warning: [], info: [] },
        optional_tour_section: { required: [], warning: [], info: [] },
        shopping_section: { required: [], warning: [], info: [] },
        included_excluded_section: { required: [], warning: [], info: [] },
      },
    } as RegisterParsed['detailBodyStructured'])

    const patchedDetail = refreshHanatourDetailBodyPolicy({
      ...baseDetail!,
      flightStructured: apiFlight!,
    })

    const parsed: RegisterParsed = {
      title: '테스트',
      extractionFieldIssues: [
        { field: 'flight_info', reason: '[REVIEW REQUIRED] 편명 누락', source: 'auto', severity: 'warn' },
        { field: 'flight_info', reason: '[REVIEW REQUIRED] 항공 구조화 실패', source: 'auto', severity: 'warn' },
        { field: 'hotel_info', reason: '[REVIEW REQUIRED] 호텔 섹션이 있으나 row 복원 실패', source: 'auto', severity: 'warn' },
      ],
      detailBodyStructured: patchedDetail,
      outboundFlightNo: 'TW0643',
      inboundFlightNo: 'TW0644',
      airlineName: '티웨이',
    } as RegisterParsed

    const out = reconcileHanatourExtractionFieldIssuesAfterDetailBodyPatch(parsed)
    const flightIssues = (out.extractionFieldIssues ?? []).filter((i) => i.field === 'flight_info')
    expect(flightIssues.some((i) => /편명|구조화 실패|출발\/도착/.test(i.reason))).toBe(false)
    expect(out.extractionFieldIssues?.some((i) => i.field === 'hotel_info')).toBe(true)
  })
})
