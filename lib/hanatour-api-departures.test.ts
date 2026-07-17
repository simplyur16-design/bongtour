import { describe, expect, it } from 'vitest'
import {
  buildHanatourPkgProdLstBody,
  hanatourProdInfoToDepartureInput,
  hanatourProdListRowToDepartureInput,
  hanatourYmdFromDepDay,
  filterHanatourProdListRowsForAnchorSaleProdCd,
  filterHanatourProdListRowsForAnchorProductLine,
  isHanatourAirtelLikeProdInfo,
  resolveHanatourApiAirtelLike,
  parseHanatourPkgCdFromUrl,
} from '@/lib/hanatour-api-departures'

describe('buildHanatourPkgProdLstBody', () => {
  it('uses depYm month query — not month-end depDay (package CPP171 gap)', () => {
    const body = buildHanatourPkgProdLstBody(
      { prodAreaCd: 'AEP', depCityCd: 'ICN', rprsProdCd: 'MCP1085' },
      '2026-08',
    )
    expect(body.depYm).toBe('202608')
    expect(body.depDay).toBe('')
    expect(body.rprsProdCds).toBe('MCP1085')
  })
})

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

describe('resolveHanatourApiAirtelLike', () => {
  const airtelMeta = { prodAttrCd: 'B', frdmSchdDvCd: 'FS' }

  it('admin overseas — API 자유여행 메타여도 패키지 모드', () => {
    expect(resolveHanatourApiAirtelLike(airtelMeta, { adminTravelScope: 'overseas' })).toBe(false)
  })

  it('admin air_hotel_free — API 패키지 메타여도 자유여행 모드', () => {
    expect(
      resolveHanatourApiAirtelLike({ prodAttrCd: 'P', frdmSchdDvCd: 'NS' }, { adminTravelScope: 'air_hotel_free' }),
    ).toBe(true)
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

describe('filterHanatourProdListRowsForAnchorSaleProdCd', () => {
  it('keeps only URL saleProdCd — 패키지·다른 호텔 variant 제외', () => {
    const rows = [
      { saleProdCd: 'PAP101260920JQ1', depDay: '20260920', adtAmt: 3190000 },
      { saleProdCd: 'PAB101260920JQ9', depDay: '20260920', adtAmt: 2289000 },
      { saleProdCd: 'PAB101260920JQ1', depDay: '20260920', adtAmt: 2059000 },
      { saleProdCd: 'PAB101260903KE1', depDay: '20260903', adtAmt: 4419000 },
    ]
    const filtered = filterHanatourProdListRowsForAnchorSaleProdCd(rows, 'PAB101260920JQ1')
    expect(filtered.map((r) => r.saleProdCd)).toEqual(['PAB101260920JQ1'])
    expect(filtered[0]?.adtAmt).toBe(2059000)
  })

  it('empty anchor returns no rows — rprsProdCd 혼합 목록 그대로 쓰지 않음', () => {
    const rows = [{ saleProdCd: 'A', depDay: '20260920', adtAmt: 1 }]
    expect(filterHanatourProdListRowsForAnchorSaleProdCd(rows, '')).toEqual([])
  })
})

describe('filterHanatourProdListRowsForAnchorProductLine', () => {
  const anchorInfo = {
    saleProdCd: 'PAB101260920JQ1',
    saleProdNm: '[자유여행] 시드니 6일 #파라독스 호텔',
    prodMstrCd: 'PAB101',
    trvlDayCnt: 6,
    prodAttrCd: 'B',
    frdmSchdDvCd: 'FS',
  }

  it('같은 호텔·6일 — 9월 다출발 포함, 패키지·7일·다른 호텔 제외', () => {
    const rows = [
      { saleProdCd: 'PAP101260920JQ1', depDay: '20260920', adtAmt: 3190000, saleProdNm: '시드니 6일 패키지' },
      { saleProdCd: 'PAB101260903KE1', depDay: '20260903', adtAmt: 4419000, saleProdNm: '시드니 7일 #에어텔' },
      { saleProdCd: 'PAB101260920JQ9', depDay: '20260920', adtAmt: 2289000, saleProdNm: '[자유여행] 시드니 6일 #샹그리라' },
      { saleProdCd: 'PAB101260920JQ1', depDay: '20260920', adtAmt: 2059000, saleProdNm: '[자유여행] 시드니 6일 #파라독스' },
      { saleProdCd: 'PAB101260921TW1', depDay: '20260921', adtAmt: 3219000, saleProdNm: '[자유여행] 시드니 6일 #파라독스' },
      { saleProdCd: 'PAB101260926JQ1', depDay: '20260926', adtAmt: 1689000, saleProdNm: '[자유여행] 시드니 6일 #파라독스' },
    ]
    const filtered = filterHanatourProdListRowsForAnchorProductLine(rows, anchorInfo, 'PAB101260920JQ1')
    expect(filtered.map((r) => r.saleProdCd)).toEqual([
      'PAB101260920JQ1',
      'PAB101260921TW1',
      'PAB101260926JQ1',
    ])
  })

  it('admin overseas — PAP anchor·자유여행 메타 시 PAB 제외·동일 패키지라인 PAP 유지', () => {
    const packageAnchor = {
      saleProdCd: 'PAP101260920JQ1',
      saleProdNm: '시드니 6일 패키지',
      prodMstrCd: 'PAP101',
      trvlDayCnt: 6,
      prodAttrCd: 'B',
      frdmSchdDvCd: 'FS',
    }
    const rows = [
      { saleProdCd: 'PAP101260920JQ1', depDay: '20260920', adtAmt: 3190000, saleProdNm: '시드니 6일 패키지' },
      { saleProdCd: 'PAP101260921JQ1', depDay: '20260921', adtAmt: 3290000, saleProdNm: '시드니 6일 패키지' },
      { saleProdCd: 'PAB101260920JQ1', depDay: '20260920', adtAmt: 2059000, saleProdNm: '[자유여행] 시드니 6일 #파라독스' },
    ]
    const misclassified = filterHanatourProdListRowsForAnchorProductLine(rows, packageAnchor, 'PAP101260920JQ1')
    expect(misclassified.map((r) => r.saleProdCd)).toEqual(['PAP101260920JQ1'])

    const filtered = filterHanatourProdListRowsForAnchorProductLine(rows, packageAnchor, 'PAP101260920JQ1', {
      adminTravelScope: 'overseas',
    })
    expect(filtered.map((r) => r.saleProdCd)).toEqual(['PAP101260920JQ1', 'PAP101260921JQ1'])
  })

  it('CAP 패키지 — 출발일별 saleProdCd suffix가 달라도 동일 마스터·일수 유지', () => {
    const anchorInfo = {
      saleProdCd: 'CAP104260801TWM',
      saleProdNm: '대만 관광 4일',
      prodMstrCd: 'CAP104',
      trvlDayCnt: 4,
      prodAttrCd: 'P',
      frdmSchdDvCd: 'NS',
    }
    const rows = [
      { saleProdCd: 'CAP104260801TWM', depDay: '20260801', adtAmt: 500000, saleProdNm: '대만 관광 4일' },
      { saleProdCd: 'CAP104260815TWJ', depDay: '20260815', adtAmt: 520000, saleProdNm: '대만 관광 4일' },
      { saleProdCd: 'CAP104260822ABC', depDay: '20260822', adtAmt: 510000, saleProdNm: '대만 관광 4일' },
      { saleProdCd: 'PAB101260920JQ1', depDay: '20260920', adtAmt: 2059000, saleProdNm: '[자유여행] 시드니 6일' },
    ]
    const filtered = filterHanatourProdListRowsForAnchorProductLine(rows, anchorInfo, 'CAP104260801TWM', {
      adminTravelScope: 'overseas',
    })
    expect(filtered.map((r) => r.saleProdCd)).toEqual([
      'CAP104260801TWM',
      'CAP104260815TWJ',
      'CAP104260822ABC',
    ])
  })

  it('해외여행 anchor — PAB·에어텔 명칭 전용 행 혼입 금지 (prefix 목록 밖 anchor 포함)', () => {
    const anchorInfo = {
      saleProdCd: 'ZZZ999260801AAA',
      saleProdNm: '테스트 패키지 5일',
      prodMstrCd: 'ZZZ999',
      trvlDayCnt: 5,
      prodAttrCd: 'P',
    }
    const rows = [
      { saleProdCd: 'ZZZ999260801AAA', depDay: '20260801', adtAmt: 400000, saleProdNm: '테스트 패키지 5일' },
      { saleProdCd: 'ZZZ999260815BBB', depDay: '20260815', adtAmt: 410000, saleProdNm: '테스트 패키지 5일' },
      { saleProdCd: 'PAB101260920JQ1', depDay: '20260920', adtAmt: 2059000, saleProdNm: '[자유여행] 시드니 6일' },
      { saleProdCd: 'PAP101260920JQ1', depDay: '20260920', adtAmt: 3190000, saleProdNm: '시드니 6일 패키지' },
    ]
    const filtered = filterHanatourProdListRowsForAnchorProductLine(rows, anchorInfo, 'ZZZ999260801AAA', {
      adminTravelScope: 'overseas',
    })
    expect(filtered.map((r) => r.saleProdCd)).toEqual(['ZZZ999260801AAA', 'ZZZ999260815BBB'])
  })

  it('자유여행 anchor — 패키지 saleProdCd(PAP·CAP) 혼입 금지', () => {
    const rows = [
      { saleProdCd: 'PAB101260920JQ1', depDay: '20260920', adtAmt: 2059000, saleProdNm: '[자유여행] 시드니 6일 #파라독스' },
      { saleProdCd: 'PAB101260921TW1', depDay: '20260921', adtAmt: 3219000, saleProdNm: '[자유여행] 시드니 6일 #파라독스' },
      { saleProdCd: 'PAP101260920JQ1', depDay: '20260920', adtAmt: 3190000, saleProdNm: '시드니 6일 패키지' },
      { saleProdCd: 'CAP104260801TWM', depDay: '20260801', adtAmt: 500000, saleProdNm: '대만 관광 4일' },
    ]
    const filtered = filterHanatourProdListRowsForAnchorProductLine(rows, anchorInfo, 'PAB101260920JQ1', {
      adminTravelScope: 'air_hotel_free',
    })
    expect(filtered.map((r) => r.saleProdCd)).toEqual(['PAB101260920JQ1', 'PAB101260921TW1'])
  })
})
