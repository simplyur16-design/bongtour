/**
 * REGRESSION-FREEZE[modetour-register-detail-collect]
 */
import { describe, expect, it } from 'vitest'
import {
  extractModetourIncludedExcludedFromDetailInfo,
  extractModetourMustKnowFromKeyPointInfo,
  buildModetourFlightStructuredFromRoutes,
  extractModetourOptionalToursFromApiList,
  extractModetourShoppingStopsFromApiList,
  modetourHtmlNoteToPlainText,
} from './modetour-register-api-detail'
import {
  modetourFactDaysToRegisterSchedule,
  needsModetourIncludedExcludedCollect,
  needsModetourOptionalCollect,
  needsModetourScheduleCollect,
  ensureModetourRegisterScheduleImageKeywords,
} from './modetour-register-detail-collect'
import { finalizeModetourRegisterParsedShopping } from './register-modetour-shopping'
import type { RegisterParsed } from './register-llm-schema-modetour'

import { parseModetourRegisterFromApi } from './modetour-register-api-parse'

describe('modetour register api parse', () => {
  it('requires originUrl productNo', async () => {
    await expect(parseModetourRegisterFromApi('', 'modetour', { originUrl: '' })).rejects.toThrow(/originUrl/)
  })
})

describe('modetour register detail collect', () => {
  it('needs schedule collect when empty', () => {
    expect(needsModetourScheduleCollect({ schedule: [] } as RegisterParsed)).toBe(true)
    expect(
      needsModetourScheduleCollect({
        schedule: [
          { day: 1, title: '오사카', description: '관광', routeText: '오사카', imageKeyword: 'Osaka' },
        ],
      } as RegisterParsed),
    ).toBe(false)
  })

  it('ensureModetourRegisterScheduleImageKeywords fills routeText-only rows (preview SSOT)', async () => {
    const out = await ensureModetourRegisterScheduleImageKeywords({
      destination: '대만',
      title: '대만 4일',
      schedule: [
        {
          day: 2,
          title: '예류·지우펀',
          description: '관광',
          routeText: '타이페이 - 예류지질공원 - 지우펀 - 스펀',
          imageKeyword: '',
        },
      ],
    } as RegisterParsed)
    expect(out.schedule?.[0]?.imageKeyword).toMatch(/Yehliu|Jiufen|Shifen/i)
  })

  it('needs included/excluded when both missing', () => {
    expect(needsModetourIncludedExcludedCollect({} as RegisterParsed)).toBe(true)
    expect(
      needsModetourIncludedExcludedCollect({
        includedText: '항공권',
        excludedText: '팁',
      } as RegisterParsed),
    ).toBe(false)
  })

  it('maps B2C fact days to RegisterScheduleDay', () => {
    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 1,
        places: ['인천', '구마모토'],
        hotels: ['구마모토 호텔'],
        meals: ['기내식', '석식 현지식'],
        transportNote: '국제선 탑승',
      },
    ])
    expect(days).toHaveLength(1)
    expect(days[0]?.title).toMatch(/인천|구마모토/)
    expect(days[0]?.routeText).toBe('인천 - 구마모토')
    expect(days[0]?.hotelText).toContain('구마모토')
    expect(days[0]?.dinnerText).toContain('현지식')
  })

  it('LLM hasOptionalTour=false여도 structured 없으면 선택관광 수집', () => {
    expect(
      needsModetourOptionalCollect({
        hasOptionalPaste: false,
        optionalToursStructured: null,
      }),
    ).toBe(true)
  })

  it('maps GetOptionalTourList API rows to structured optional JSON', () => {
    const rows = extractModetourOptionalToursFromApiList([
      {
        name: '#[선택관광] 바나힐',
        currency: '$',
        priceAdult: 70,
        priceChild: 60,
        durationTime: '180분',
        readyPlace: '호텔 또는 자유시간',
        isWithGuide: true,
        minUserCount: 4,
      },
    ])
    expect(rows[0]?.tourName).toBe('바나힐')
    expect(rows[0]?.currency).toBe('USD')
    expect(rows[0]?.adultPrice).toBe(70)
  })

  it('maps GetShoppingList API rows to shoppingStops JSON', () => {
    const rows = extractModetourShoppingStopsFromApiList([
      {
        itemName: '노니&침향',
        contentsPlaceInfos: ['BEST노니', '퍼스트'],
        durationTime: '60분',
        isRefundEnabled: true,
      },
    ])
    expect(rows[0]?.shoppingItem).toBe('노니&침향')
    expect(rows[0]?.placeName).toBe('BEST노니')
    expect(rows[0]?.candidateOnly).toBe(true)
    expect(rows[0]?.refundPolicyText).toBe('환불가능')
  })

  it('splits Taiwan 잡화점+DFS API 1건 into 2 shopping visit groups', () => {
    const rows = extractModetourShoppingStopsFromApiList([
      {
        itemName: '잡화점(기념품&토산품)',
        contentsPlaceInfos: [
          '펑리(鳳澧)',
          '모공주(毛公主)',
          '아이이창(艾伊昶百貨)',
          '문창(台灣文創藝術館)',
          '정영차관(​定迎有限公司)',
          '벽해풍수(碧海風水)',
          '미림각(美霖閣文物舘)',
          '야미(YAMI)',
          'DFS에버리치(EVERRICH昇恆昌內湖旗艦店)',
        ],
        durationTime: '60분',
        isRefundEnabled: true,
      },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.shoppingItem).toBe('잡화점(기념품&토산품)')
    expect(rows[0]?.placeName).toBe('펑리(鳳澧)')
    expect(rows[0]?.candidateOnly).toBe(true)
    expect(String(rows[0]?.noteText ?? '')).toMatch(/모공주/)
    expect(rows[1]?.shoppingItem).toMatch(/DFS|에버리치/i)
    expect(String(rows[1]?.placeName ?? '')).toMatch(/DFS|에버리치/i)
  })

  it('keeps GetShoppingList API shoppingStops after finalize without body paste', () => {
    const apiJson = JSON.stringify([
      {
        itemType: '잡화점(기념품&토산품)',
        placeName: '펑리(鳳澧)',
        durationText: '60분',
        refundPolicyText: '환불가능',
        candidateOnly: true,
      },
      {
        itemType: 'DFS에버리치',
        placeName: 'DFS에버리치(EVERRICH昇恆昌內湖旗艦店)',
      },
    ])
    const out = finalizeModetourRegisterParsedShopping({
      shoppingStops: apiJson,
      shoppingVisitCount: 2,
      hasShopping: true,
    } as RegisterParsed)
    expect(out.hasShopping).toBe(true)
    expect(out.shoppingVisitCount).toBe(2)
    const kept = JSON.parse(String(out.shoppingStops)) as unknown[]
    expect(kept).toHaveLength(2)
  })

  it('parses GetProductDetailInfo includedNote/unincludedNote HTML', () => {
    const detail = {
      includedNote:
        '<p><span>- 왕복항공권</span><br /><span>- 숙박비(2인1실)</span><br /><span>- 여행자보험</span></p>',
      unincludedNote: '<p><span>- 개인경비</span><br /><span>- 가이드/기사 경비 USD 40</span></p>',
    }
    const parsed = extractModetourIncludedExcludedFromDetailInfo(detail)
    expect(parsed.includedItems).toContain('왕복항공권')
    expect(parsed.includedItems).toContain('숙박비(2인1실)')
    expect(parsed.excludedItems.some((x) => /가이드/.test(x))).toBe(true)
    expect(modetourHtmlNoteToPlainText(detail.includedNote)).toContain('왕복항공권')
  })

  it('Telerik CSS 잡음 — 포함/불포함 bullet만', () => {
    const detail = {
      includedNote:
        '<style>p{margin-top:0}</style><title>Untitled</title><p>▶ 왕복 항공권, 유류할증료 및 TAX<br />▶ 일정에 명시된 숙박 및 식사</p>',
      unincludedNote: '<p>▶ 매너팁 (선택 사항)</p>',
    }
    const parsed = extractModetourIncludedExcludedFromDetailInfo(detail)
    expect(parsed.includedItems.some((x) => /왕복/.test(x))).toBe(true)
    expect(parsed.includedItems.some((x) => /margin-top|Untitled|telerik/i.test(x))).toBe(false)
    expect(parsed.excludedItems.some((x) => /매너팁/.test(x))).toBe(true)
  })

  it('parses GetProductKeyPointInfo specialBenefits into must-know rows', () => {
    const rows = extractModetourMustKnowFromKeyPointInfo({
      specialBenefits: ['F1 연습주행 3회', '고카트 체험'],
      travelerInsuranceInfo: '가입(최대 3억원 보장)',
      productScore: '상품 핵심 포인트',
    })
    expect(rows.some((r) => r.body.includes('F1'))).toBe(true)
    expect(rows.some((r) => r.title.includes('보험'))).toBe(true)
    expect(rows.some((r) => r.body === '상품 핵심 포인트')).toBe(false)
  })

  it('builds flight structured from ItineraryDlgFlightRoute split items', () => {
    const fs = buildModetourFlightStructuredFromRoutes([
      {
        flightTypeName: 'DEPARTURE',
        item: [
          {
            departureCityName: '인천',
            departureDate: '2026-06-28T00:00:00',
            departureTime: '07:00',
          },
          {
            transportName: '비엣젯항공',
            arrivalCityName: '다낭',
            arrivalDate: '2026-06-28T00:00:00',
            arrivalTime: '09:40',
            departureFlight: 'VJ879',
          },
        ],
      },
      {
        flightTypeName: 'ARRIVAL',
        item: [
          {
            departureCityName: '다낭',
            departureDate: '2026-07-01T00:00:00',
            departureTime: '23:45',
          },
          {
            transportName: '비엣젯항공',
            arrivalCityName: '인천',
            arrivalDate: '2026-07-02T00:00:00',
            arrivalTime: '06:00',
            departureFlight: 'VJ878',
          },
        ],
      },
    ])
    expect(fs?.airlineName).toBe('비엣젯항공')
    expect(fs?.outbound.flightNo).toBe('VJ879')
    expect(fs?.inbound.flightNo).toBe('VJ878')
    expect(fs?.outbound.departureTime).toBe('07:00')
    expect(fs?.inbound.departureTime).toBe('23:45')
  })
})
