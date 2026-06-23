/**
 * REGRESSION-FREEZE[hanatour-register-detail-collect]
 */
import { describe, expect, it } from 'vitest'
import {
  formatHanatourTrvlExpnBullet,
  buildHanatourFlightStructuredFromProdInfo,
  hanatourFactDaysToRegisterSchedule,
  hanatourItnrSchdToFactDays,
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
        schedule: [{ day: 1, title: '오사카', description: '관광', imageKeyword: 'Osaka' }],
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
      expect.arrayContaining(['홍콩의 전망을 한눈에!', '빅토리아 피크', '피크트램']),
    )
    expect(facts[0]?.transportNote).toBe('인천 - 홍콩')
    expect(facts[0]?.meals[0]).toMatch(/조식/)
    const sched = hanatourFactDaysToRegisterSchedule(facts)
    expect(sched[0]?.breakfastText).toMatch(/기내/)
    expect(sched[0]?.routeText).toContain('빅토리아')
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
    expect(days[0]?.title).toBe('인천')
    expect(days[0]?.routeText).toBe('인천 - 오사카')
    expect(days[0]?.hotelText).toContain('오사카')
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
