/**
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]
 * REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]
 */
import { describe, expect, it } from 'vitest'
import {
  buildScheduleImageKeywordGeminiPrompt,
  buildFreeLeisureDayGeminiPrompt,
  groupRegisterFreeLeisureDaysByStayCity,
  inferRegisterFreeDayDurationLabel,
  inferRegisterFreeDayStayCity,
  mergeGeminiFreeLeisureRecommendedItinerary,
  parseGeminiFreeLeisureRows,
  scheduleDaysMissingImageKeyword2AfterRules,
  scheduleDaysMissingImageKeywordAfterRules,
  scheduleFreeLeisureDaysMissingImageKeyword,
} from './register-schedule-image-keyword-gemini-fill'

describe('register-schedule-image-keyword-gemini-fill', () => {
  it('scheduleDaysMissingImageKeywordAfterRules — routeText만 있고 kw 비면 대상', () => {
    const days = scheduleDaysMissingImageKeywordAfterRules([
      { day: 1, routeText: '인천 - 북경', imageKeyword: 'Beijing' },
      { day: 2, routeText: '북경 - 천안문광장 - 자금성', imageKeyword: '' },
      { day: 3, title: '귀국', description: '', routeText: '', imageKeyword: '' },
    ])
    expect(days).toEqual([2])
  })

  it('scheduleDaysMissingImageKeywordAfterRules — 인천-only·귀국일은 Gemini 대상 제외', () => {
    const days = scheduleDaysMissingImageKeywordAfterRules([
      { day: 1, routeText: '인천', imageKeyword: '' },
      { day: 2, routeText: '비엔나 - 쉔부른궁전', imageKeyword: 'Schonbrunn Palace' },
      { day: 9, routeText: '인천', imageKeyword: '' },
    ])
    expect(days).toEqual([])
  })

  it('scheduleDaysMissingImageKeyword2AfterRules — 관광·kw1만·route 2+세그먼트', () => {
    const rows = [
      { day: 1, routeText: '인천 - 북경', imageKeyword: 'Beijing', imageKeyword2: null },
      {
        day: 2,
        title: '2일차',
        routeText: '북경 - 천안문광장 - 자금성 - 십찰해',
        imageKeyword: 'Tiananmen Square',
        imageKeyword2: null,
      },
      {
        day: 3,
        routeText: '북경 - 이화원 - 만리장성',
        imageKeyword: 'Summer Palace',
        imageKeyword2: 'Great Wall of China',
      },
    ]
    expect(scheduleDaysMissingImageKeyword2AfterRules(rows)).toEqual([2])
  })

  it('scheduleFreeLeisureDaysMissingImageKeyword — 제목 자유일정 + 빈·호텔일만. 명소 있는 날은 제외', () => {
    const days = scheduleFreeLeisureDaysMissingImageKeyword(
      [
        { day: 1, routeText: '인천', imageKeyword: 'Incheon' },
        {
          day: 2,
          title: '2일차',
          description: '2일차 일정을 진행합니다.',
          routeText: '',
          imageKeyword: '',
        },
        {
          day: 3,
          title: '3일차',
          description: '성급 모벤픽 호텔을 중심으로 하루 일정을 진행합니다.',
          routeText: '성급 모벤픽 호텔',
          imageKeyword: '',
        },
        {
          day: 4,
          title: '자유일정',
          description: '개별 자유일정',
          routeText: '야스아일랜드 - 씨월드 - 페라리 월드',
          imageKeyword: '',
        },
        { day: 5, title: '귀국', routeText: '인천', imageKeyword: '' },
      ],
      '푸꾸옥 5일 #2일 자유일정',
    )
    expect(days).toEqual([2, 3])
  })

  it('scheduleFreeLeisureDaysMissingImageKeyword — 제목에 자유일정 없는 보르도 도시 only는 대상 아님', () => {
    const days = scheduleFreeLeisureDaysMissingImageKeyword([
      { day: 1, routeText: '파리 - 보르도', imageKeyword: 'Paris' },
      { day: 2, title: '보르도', routeText: '보르도', imageKeyword: '' },
      { day: 3, title: '보르도', routeText: '보르도', imageKeyword: '' },
      { day: 4, title: '보르도', routeText: '보르도', imageKeyword: '' },
      { day: 5, routeText: '보르도 - 파리', imageKeyword: 'Paris' },
      { day: 6, title: '귀국', routeText: '', imageKeyword: '' },
    ])
    expect(days).toEqual([])
  })

  it('scheduleFreeLeisureDaysMissingImageKeyword — 제목 #3일 자유일정이면 보르도 빈 날이 대상', () => {
    const days = scheduleFreeLeisureDaysMissingImageKeyword(
      [
        { day: 1, routeText: '파리 - 보르도', imageKeyword: 'Paris' },
        { day: 2, title: '보르도', routeText: '보르도', imageKeyword: '' },
        { day: 3, title: '보르도', routeText: '보르도', imageKeyword: '' },
        { day: 4, title: '보르도', routeText: '보르도', imageKeyword: '' },
        { day: 5, routeText: '보르도 - 파리', imageKeyword: 'Paris' },
        { day: 6, title: '귀국', routeText: '', imageKeyword: '' },
      ],
      '보르도 5일 #3일 자유일정',
    )
    expect(days).toEqual([2, 3, 4])
  })

  it('scheduleFreeLeisureDaysMissingImageKeyword — dest 키워드만 있어도 제목 자유일정이면 대상', () => {
    const days = scheduleFreeLeisureDaysMissingImageKeyword(
      [
        { day: 1, routeText: '인천', imageKeyword: 'Incheon' },
        {
          day: 2,
          title: '2일차',
          description: '2일차 일정을 진행합니다.',
          routeText: '괌',
          imageKeyword: 'Guam',
        },
        { day: 3, title: '귀국', routeText: '인천', imageKeyword: '' },
      ],
      '괌 4일 #1일 자유일정',
    )
    expect(days).toEqual([2])
  })

  it('scheduleFreeLeisureDaysMissingImageKeyword — 예레반-두바이 환승·이동은 제목에 자유일정이 있어도 제외', () => {
    const days = scheduleFreeLeisureDaysMissingImageKeyword(
      [
        { day: 1, routeText: '인천 - 트빌리시', imageKeyword: 'Tbilisi' },
        { day: 2, title: '트빌리시', routeText: '트빌리시 구시가지', imageKeyword: 'Old Tbilisi' },
        {
          day: 9,
          title: '예레반 · 두바이 시티',
          routeText: '예레반 - 두바이 - 두바이 시티',
          imageKeyword: '',
        },
        { day: 10, title: '귀국', routeText: '인천', imageKeyword: '' },
      ],
      '코카서스 10일 #2일 자유일정',
    )
    expect(days).toEqual([])
  })

  it('inferRegisterFreeDayStayCity — 인접일 동선 도시, duration은 제목 반나절/1day', () => {
    const rows = [
      { day: 1, routeText: '인천 - 피렌체', imageKeyword: 'Florence' },
      { day: 2, title: '2일차', routeText: '', imageKeyword: '' },
      { day: 3, routeText: '피렌체 - 로마', imageKeyword: 'Colosseum' },
    ]
    expect(
      inferRegisterFreeDayStayCity({
        row: rows[1]!,
        rows,
        productTitle: '토스카나 5일',
        productDestination: '이탈리아',
      }),
    ).toMatch(/Florence|피렌체/i)
    expect(inferRegisterFreeDayDurationLabel('보르도 5일 #1일 자유일정', { day: 2 })).toBe('1day')
    expect(inferRegisterFreeDayDurationLabel('괌 4일 #반나절 자유일정', { day: 2 })).toBe('반나절')
    const grouped = groupRegisterFreeLeisureDaysByStayCity(
      [
        { day: 1, routeText: '보르도', imageKeyword: 'Bordeaux' },
        { day: 2, routeText: '', imageKeyword: '' },
        { day: 3, routeText: '', imageKeyword: '' },
        { day: 4, routeText: '보르도', imageKeyword: 'Bordeaux' },
      ],
      [2, 3],
      { productTitle: '보르도 4일', productDestination: '보르도' },
    )
    expect(grouped).toHaveLength(2)
    expect(grouped[0]?.stayCity).toBe(grouped[1]?.stayCity)
  })

  it('mergeGeminiFreeLeisureRecommendedItinerary — 제목·동선에 추천일정, 명소 있는 날은 유지', () => {
    const byDay = parseGeminiFreeLeisureRows([
      {
        day: 2,
        stayCity: 'Bordeaux',
        duration: '1day',
        title: '추천일정 1day',
        recommendedRoute: '보르도 - 시테 뒤 뱅 - 미로아르 도',
        imageKeyword: 'Cite du Vin Bordeaux',
        imageKeyword2: "Miroir d'eau Bordeaux",
      },
      {
        day: 3,
        stayCity: 'Abu Dhabi',
        duration: '반나절',
        recommendedRoute: '야스아일랜드 - 페라리 월드',
        imageKeyword: 'Ferrari World',
        imageKeyword2: 'Yas Island',
      },
    ])
    const merged = mergeGeminiFreeLeisureRecommendedItinerary(
      [
        { day: 1, routeText: '인천 - 보르도', imageKeyword: 'Bordeaux' },
        { day: 2, title: '2일차', routeText: '', imageKeyword: '' },
        {
          day: 3,
          title: '자유일정',
          routeText: '야스아일랜드 - 씨월드 - 페라리 월드',
          imageKeyword: '',
        },
      ],
      byDay,
      { productTitle: '보르도 4일' },
    )
    expect(merged[1]?.title).toBe('추천일정 1day')
    expect(merged[1]?.routeText).toMatch(/시테 뒤 뱅/)
    expect(merged[1]?.description).toMatch(/자유일정 추천/)
    expect(merged[1]?.imageKeyword).toMatch(/Cite du Vin/i)
    expect(merged[2]?.routeText).toBe('야스아일랜드 - 씨월드 - 페라리 월드')
    expect(merged[2]?.title).toBe('추천일정 반나절')
  })

  it('buildFreeLeisureDayGeminiPrompt — 도시별 빈 날 수·추천일정 persist', () => {
    const prompt = buildFreeLeisureDayGeminiPrompt(
      [
        { day: 1, routeText: '보르도', imageKeyword: 'Bordeaux' },
        { day: 2, title: '자유일정', routeText: '', description: '개별 자유일정' },
        { day: 3, title: '자유일정', routeText: '', description: '개별 자유일정' },
        { day: 4, routeText: '보르도', imageKeyword: 'Bordeaux' },
      ],
      { productDestination: '보르도', productTitle: '보르도 4일 #1일 자유일정', daysToFill: [2, 3] },
    )
    expect(prompt).toMatch(/Free-leisure/)
    expect(prompt).toMatch(/recommendedRoute/)
    expect(prompt).toMatch(/imageKeyword2/)
    expect(prompt).toMatch(/2 empty free day/)
    expect(prompt).toMatch(/추천일정/)
  })

  it('buildScheduleImageKeywordGeminiPrompt — routeText 순서·dual-slot·canonical resolve 규칙 포함', () => {
    const prompt = buildScheduleImageKeywordGeminiPrompt(
      [
        {
          day: 4,
          routeText: '나트랑 - 분짜+반쎄오 - 포나가 참 사원 - 담 재래시장 - 롱선사',
          title: '4일차',
        },
      ],
      { productDestination: '동남아', productTitle: '베트남 5일', daysToFill: [4] },
    )
    expect(prompt).toMatch(/routeText="나트랑 - 분짜\+반쎄오 - 포나가 참 사원/)
    expect(prompt).toMatch(/imageKeyword2/)
    expect(prompt).toMatch(/Do NOT translate Korean/)
    expect(prompt).toMatch(/Po Nagar Cham Towers/)
    expect(prompt).toMatch(/resolve the standard English proper name/)
  })
})
