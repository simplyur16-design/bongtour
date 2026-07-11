/**
 * REGRESSION-FREEZE[hanatour-register-detail-collect]
 */
import { describe, expect, it } from 'vitest'
import {
  formatHanatourTrvlExpnBullet,
  buildHanatourFlightStructuredFromProdInfo,
  hanatourFactDaysToRegisterSchedule,
  hanatourItnrSchdToFactDays,
  applyHanatourProdInfoHotelsToFactDays,
  selectHanatourScheduleHighlights,
  extractHanatourIncludedExcluded,
  extractHanatourOptionalToursFromChcStsng,
} from './hanatour-register-api-detail'
import {
  needsHanatourExcludedCollect,
  needsHanatourIncludedCollect,
  needsHanatourIncludedExcludedCollect,
  needsHanatourOptionalCollect,
  needsHanatourScheduleCollect,
  isHanatourPlaceholderScheduleRow,
} from './hanatour-register-detail-collect'
import type { RegisterParsed } from './register-llm-schema-hanatour'

describe('hanatour register detail collect', () => {
  it('needs schedule collect when empty or title-less', () => {
    expect(needsHanatourScheduleCollect({ schedule: [] } as RegisterParsed)).toBe(true)
    expect(
      needsHanatourScheduleCollect({
        schedule: [{ day: 1, title: '', description: '', imageKeyword: 'x' }],
      } as RegisterParsed),
    ).toBe(true)
    expect(
      needsHanatourScheduleCollect({
        schedule: [
          { day: 1, title: '오사카', description: '관광', routeText: '오사카', imageKeyword: 'Osaka' },
        ],
      } as RegisterParsed),
    ).toBe(false)
    expect(
      needsHanatourScheduleCollect({
        schedule: [{ day: 1, title: '1일차', description: '1일차', imageKeyword: '' }],
      } as RegisterParsed),
    ).toBe(true)
    expect(
      isHanatourPlaceholderScheduleRow({
        day: 1,
        title: '일차 동선',
        description: '1일차',
        imageKeyword: 'Hong Kong',
      }),
    ).toBe(true)
  })

  it('itnr schd cards — cardNm·mealCont·cmsInfoList에서 일정·식사 추출', () => {
    const facts = hanatourItnrSchdToFactDays([
      {
        schdDay: 1,
        schdMainInfoList: [
          {
            schdCatgNm: '관광지',
            cardNm: '홍콩의 전망을 한눈에!',
            cmsInfoList: [{ cmsCntntNm: '빅토리아 피크' }, { cmsCntntNm: '피크트램' }],
          },
          { schdCatgNm: '도시간이동', depCityNm: '인천', arriveCityNm: '홍콩' },
          {
            schdCatgNm: '식사',
            dtlMealDvNm: '조식',
            mealCont: '기내-불포함(유료제공)',
          },
        ],
      },
    ])
    expect(facts).toHaveLength(1)
    expect(facts[0]?.places).toEqual(
      expect.arrayContaining(['빅토리아 피크', '피크트램']),
    )
    expect(facts[0]?.transportNote).toBe('인천 - 홍콩')
    expect(facts[0]?.meals[0]).toMatch(/조식/)
    const sched = hanatourFactDaysToRegisterSchedule(facts)
    expect(sched[0]?.breakfastText).toMatch(/기내/)
    expect(sched[0]?.routeText).toContain('빅토리아')
    expect(sched[0]?.routeText).not.toMatch(/전망을 한눈에/)
    expect(sched[0]?.title?.split(' - ').length ?? 0).toBeLessThanOrEqual(7)
    expect(sched[0]?.description).not.toBe(sched[0]?.routeText)
    expect(sched[0]?.description).toMatch(/하루\s*동안\s*여러\s*장면|스카이라인|감성/)
  })

  it('CHP101-style — highlights ≤7, prose description, prodInfo hotel fallback', () => {
    const facts = applyHanatourProdInfoHotelsToFactDays(
      [
        {
          day: 1,
          places: [
            '홍콩',
            '피크트램',
            '빅토리아 피크',
            '피크트램 (NEW)',
            '빅토리아피크',
            '소호 거리(SoHo)',
            '미드-레벨 에스컬레이터',
            '소호거리_벽화',
            '홍콩섬 완차이, 컬러풀 홍콩 즐기기',
          ],
          hotels: [],
          meals: ['조식 기내-불포함(유료제공)'],
          transportNote: '인천; 홍콩',
        },
        {
          day: 3,
          places: ['행운을 빌어요, 럭키 홍콩', '웡타이신 사원'],
          hotels: [],
          meals: ['조식'],
          transportNote: '홍콩; 인천',
        },
      ],
      {
        saleProdNm: '[출발확정] 홍콩/마카오 3일 #베스트셀러',
        smplSchdCont: '홍콩(1)-마카오(0)-홍콩(1)',
        bnftInfoList: [
          { corePntCont: '② 가성비+가심비 홍콩 4성호텔 숙박<br/>③ 홍콩 하이라이트 투어' },
        ],
      },
    )
    const sched = hanatourFactDaysToRegisterSchedule(facts)
    expect(selectHanatourScheduleHighlights(facts[0]!.places).length).toBeLessThanOrEqual(7)
    expect(sched[0]?.title?.split(' - ').length ?? 0).toBeLessThanOrEqual(7)
    expect(sched[0]?.description).not.toBe(sched[0]?.routeText)
    expect(sched[0]?.description).toMatch(/하루\s*동안\s*여러\s*장면|세련된 번화가/)
    expect(sched[0]?.description).not.toMatch(/피크|빅토리아/)
    expect(sched[0]?.hotelText).toMatch(/4성호텔/)
    expect(sched[1]?.description).toMatch(/여유|마무리|귀국|여운/)
    expect(sched[1]?.description).not.toMatch(/웡타이신/)
    expect(sched[1]?.hotelText).toMatch(/숙박 없음/)
  })

  it('포르투갈 ITNR — 마케팅 카드명 제거 후 routeText a–g만', () => {
    const facts = hanatourItnrSchdToFactDays([
      {
        schdDay: 2,
        schdMainInfoList: [
          {
            schdCatgNm: '관광지',
            cardNm: '땅이 끝나고 바다가 시작되는 곳, 까보다로까',
            cmsInfoList: [
              { cmsCntntNm: '까보다로까 로카곶' },
              { cmsCntntNm: '유럽인들이 살고싶어 하는 최고의 포르투갈 휴양지, 카스카이스' },
              { cmsCntntNm: '카스카이스해변' },
              { cmsCntntNm: '작은 동화속 마을 신트라 관광' },
            ],
          },
        ],
      },
      {
        schdDay: 8,
        schdMainInfoList: [
          {
            schdCatgNm: '관광지',
            cmsInfoList: [
              { cmsCntntNm: '대항해 시대의 중심 도시, 리스본' },
              { cmsCntntNm: '제로니모스 수도원' },
              { cmsCntntNm: 'lisbon-7681991' },
            ],
          },
        ],
      },
    ])
    const sched = hanatourFactDaysToRegisterSchedule(facts)
    expect(sched[0]?.routeText).toBe('까보다로까 - 로카곶 - 카스카이스 - 카스카이스해변 - 신트라')
    expect(sched[0]?.routeText).not.toMatch(/땅이 끝나고|살고싶어|동화속 마을/)
    expect(sched[0]?.description).not.toBe(sched[0]?.routeText)
    expect(sched[0]?.description).toMatch(/하루|여러\s*장면|분위기|리듬|절경|구성/)
    expect(sched[1]?.routeText).toMatch(/리스본/)
    expect(sched[1]?.routeText).toMatch(/제로니모스/)
    expect(sched[1]?.routeText).not.toMatch(/7681991|대항해 시대/)
  })

  it('needs included/excluded when both missing', () => {
    expect(needsHanatourIncludedExcludedCollect({} as RegisterParsed)).toBe(true)
    expect(
      needsHanatourIncludedExcludedCollect({
        includedText: '항공권',
        excludedText: '팁',
      } as RegisterParsed),
    ).toBe(false)
  })

  it('LLM hasOptionalTour=false여도 structured 없으면 선택관광 수집', () => {
    expect(
      needsHanatourOptionalCollect({
        hasOptionalPaste: false,
        optionalToursStructured: null,
      }),
    ).toBe(true)
  })

  it('포함만 있어도 불포함 수집 필요', () => {
    expect(
      needsHanatourIncludedCollect({
        includedText: '항공권',
      } as RegisterParsed),
    ).toBe(false)
    expect(
      needsHanatourExcludedCollect({
        includedText: '항공권',
      } as RegisterParsed),
    ).toBe(true)
  })

  it('formats trvlExpnDesc with cluster prefix', () => {
    expect(
      formatHanatourTrvlExpnBullet({
        trvlExpnClstNm: '항공',
        trvlExpnDesc: '왕복 항공권',
        trvlExpnNm: 'legacy',
      }),
    ).toBe('항공 왕복 항공권')
  })

  it('maps fact days to RegisterScheduleDay', () => {
    const days = hanatourFactDaysToRegisterSchedule([
      {
        day: 1,
        places: ['인천', '오사카'],
        hotels: ['오사카 호텔'],
        meals: ['기내식', '석식 현지식'],
        transportNote: '국제선 탑승',
      },
    ])
    expect(days).toHaveLength(1)
    expect(days[0]?.title).toBe('오사카')
    expect(days[0]?.routeText).toBe('오사카')
    expect(days[0]?.hotelText).toContain('오사카')
    expect(days[0]?.description).not.toContain('\n')
    expect(days[0]?.lunchText).toBe('기내식')
    expect(days[0]?.dinnerText).toBe('현지식')
    expect(days[0]?.mealSummaryText).toContain('석식')
  })

  it('merges fees into excluded items', () => {
    const { includedItems, excludedItems } = extractHanatourIncludedExcluded({
      trvlExpnInclList: [{ trvlExpnDesc: '왕복 항공권' }],
      trvlExpnNoneInclList: [{ trvlExpnDesc: '개인 경비' }],
      snglAddAmt: 500000,
      snglAddAmtDesc: '1인실 사용료 500,000원',
      guideExpnAmt: 20,
      guideExpnCurrCd: 'USD',
    })
    expect(includedItems).toContain('왕복 항공권')
    expect(excludedItems.some((x) => /개인 경비/.test(x))).toBe(true)
    expect(excludedItems.some((x) => /1인실|객실/i.test(x))).toBe(true)
    expect(excludedItems.some((x) => /가이드|기사/.test(x))).toBe(true)
  })

  it('extractHanatourOptionalToursFromChcStsng — chcInfoList 카탈로그', () => {
    const rows = extractHanatourOptionalToursFromChcStsng({
      data: {
        chcInfoList: [
          {
            chcStsngNm: 'KK 스타 라운지',
            currCd: 'USD',
            adtAmt: 15,
            chdAmt: 15,
            rqrmTmInfo: '약 2시간',
            spclStsngYn: 'N',
          },
          {
            chcStsngNm: 'MD추천 선셋 반딧불이 투어',
            currCd: 'USD',
            adtAmt: 40,
            mrchRcmnYn: 'Y',
          },
        ],
      },
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]?.name).toBe('KK 스타 라운지')
    expect(rows[0]?.adultPrice).toBe(15)
    expect(rows[1]?.name).toBe('선셋 반딧불이 투어')
    expect(rows[1]?.supplierTags).toContain('MD추천')
  })

  it('itnr — 유의사항·출입국 안내 카드는 schedule places에서 제외', () => {
    const facts = hanatourItnrSchdToFactDays([
      {
        schdDay: 1,
        schdMainInfoList: [
          {
            schdCatgNm: '안내',
            schdTitlNm: '✅ 두바이 상품 예약시 유의사항',
            schdCont: '두바이 및 아부다비 출입국 정보',
          },
          { schdCatgNm: '도시간이동', depCityNm: '인천', arriveCityNm: '두바이' },
        ],
      },
      {
        schdDay: 6,
        schdMainInfoList: [
          {
            schdCatgNm: '관광지',
            cardNm: '[추천 프로그램] 야스아일랜드 테마파크',
            cmsInfoList: [{ cmsCntntNm: '씨월드' }, { cmsCntntNm: '페라리 월드' }],
          },
        ],
      },
    ])
    expect(facts[0]?.places).toEqual([])
    expect(facts[0]?.transportNote).toBe('인천 - 두바이')
    const sched = hanatourFactDaysToRegisterSchedule(facts)
    expect(sched[0]?.title).toBe('두바이')
    expect(sched[0]?.routeText).toBe('두바이')
    expect(sched[0]?.title).not.toMatch(/유의사항/)
    expect(facts[1]?.places.some((p) => /야스|씨월드|페라리/.test(p))).toBe(true)
    expect(
      isHanatourPlaceholderScheduleRow({
        day: 1,
        title: '두바이 상품 예약시 유의사항',
        description: '',
        imageKeyword: '',
      }),
    ).toBe(true)
  })

  it('builds flight structured from pkgAirSeqList', () => {
    const fs = buildHanatourFlightStructuredFromProdInfo({
      depDay: '20260628',
      pkgAirSeqList: [
        {
          segSeq: '1',
          airlCd: 'AK',
          airlNm: '에어아시아',
          flgtNm: '1624',
          depHm: '0920',
          arrHm: '1330',
          depAptCd: 'ICN',
          depAptNm: '인천 국제공항',
          arrAptCd: 'BKI',
          arrAptNm: '코타키나발루 국제공항',
          depBassFlxbDt: '0',
          arrBassFlxbDt: '0',
        },
        {
          segSeq: '2',
          airlCd: 'AK',
          airlNm: '에어아시아',
          flgtNm: '1623',
          depHm: '0155',
          arrHm: '0820',
          depAptCd: 'BKI',
          depAptNm: '코타키나발루 국제공항',
          arrAptCd: 'ICN',
          arrAptNm: '인천 국제공항',
          depBassFlxbDt: '4',
          arrBassFlxbDt: '4',
        },
      ],
    })
    expect(fs?.airlineName).toContain('에어아시아')
    expect(fs?.outbound.flightNo).toBe('AK1624')
    expect(fs?.inbound.flightNo).toBe('AK1623')
    expect(fs?.outbound.departureTime).toBe('09:20')
    expect(fs?.inbound.departureTime).toBe('01:55')
  })
})
