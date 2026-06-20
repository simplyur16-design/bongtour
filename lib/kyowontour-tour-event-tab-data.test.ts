/**
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop] — goodsEvtTab_2/7 tourEventTabData
 */
import { describe, it, expect } from 'vitest'
import {
  CSP302_CORE_TAB1_DETAIL_FIXTURE,
  CSP302_OPT_SHOP_TAB7_DETAIL_FIXTURE,
  CSP302_RESERVATION_TAB3_DETAIL_FIXTURE,
  CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE,
  KYOWONTOUR_TAB_CORE_ID,
  KYOWONTOUR_TAB_OPT_SHOP_ID,
  KYOWONTOUR_TAB_SCHEDULE_ID,
  KYOWONTOUR_TAB_PROBE_IDS,
  parseKyowontourCoreTabDetail,
  parseKyowontourOptShopTabDetail,
  parseKyowontourReservationTabDetail,
  parseKyowontourScheduleTabDetail,
  parseKyowontourShoppingListRow,
  parseKyowontourEtcTourRow,
} from './kyowontour-tour-event-tab-data'
import { scheduleTabParsedToRegisterDays } from './kyowontour-register-schedule-collect'

describe('kyowontour tourEventTabData opt/shop', () => {
  it('probe tab SSOT — 선택관광/쇼핑은 goodsEvtTab_7', () => {
    const optShop = KYOWONTOUR_TAB_PROBE_IDS.find((t) => t.label === '선택관광/쇼핑')
    expect(optShop?.tabId).toBe(KYOWONTOUR_TAB_OPT_SHOP_ID)
    expect(KYOWONTOUR_TAB_OPT_SHOP_ID).toBe('goodsEvtTab_7')
  })

  it('CSP302 fixture — 쇼핑 2행·선택관광 6건', () => {
    const parsed = parseKyowontourOptShopTabDetail(CSP302_OPT_SHOP_TAB7_DETAIL_FIXTURE)
    expect(parsed.shoppingVisitCount).toBe(2)
    expect(parsed.shoppingItems).toHaveLength(2)
    expect(parsed.shoppingItems[0]?.itemName).toBe('보이차')
    expect(parsed.shoppingItems[1]?.shopLocation).toBe('곤명')
    expect(parsed.optionalTours).toHaveLength(6)
    expect(parsed.optionalTours[0]?.name).toBe('빙천세계 케이블카')
    expect(parsed.optionalTours[0]?.currency).toBe('USD')
    expect(parsed.optionalTours[0]?.priceAdult).toBe(50)
    expect(parsed.optionalTours[1]?.alternativeProgram).toBe('지정장소 자유 시간(가이드 비동행)')
  })

  it('행 파서 — shopping_list·etcTour 키 매핑', () => {
    const shop = parseKyowontourShoppingListRow({
      item: '침향',
      location: '곤명',
      time: '약 1시간',
      cancel: '개별확인',
    })
    expect(shop).toEqual({
      itemName: '침향',
      shopLocation: '곤명',
      duration: '약 1시간',
      refundable: '개별확인',
    })
    const opt = parseKyowontourEtcTourRow({
      nameKo: '호도협 미니트래킹',
      adultPrice: 50,
      currencyCode: 'USD',
      timeRequired: '약 2시간',
      otherSchedule: '대체일정',
      descriptionShort: '짧은 설명',
    })
    expect(opt?.name).toBe('호도협 미니트래킹')
    expect(opt?.description).toBe('짧은 설명')
    expect(opt?.duration).toBe('약 2시간')
    expect(opt?.alternativeProgram).toBe('대체일정')
  })
})

describe('kyowontour tourEventTabData schedule', () => {
  it('probe tab SSOT — 여행일정표는 goodsEvtTab_2', () => {
    const schedule = KYOWONTOUR_TAB_PROBE_IDS.find((t) => t.label === '여행일정표')
    expect(schedule?.tabId).toBe(KYOWONTOUR_TAB_SCHEDULE_ID)
    expect(KYOWONTOUR_TAB_SCHEDULE_ID).toBe('goodsEvtTab_2')
  })

  it('CSP302 fixture — 일정 2일차·식사·관광지 매핑', () => {
    const parsed = parseKyowontourScheduleTabDetail(CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE)
    expect(parsed.dayCount).toBe(2)
    expect(parsed.rows).toHaveLength(6)
    expect(parsed.meals).toHaveLength(2)
    const days = scheduleTabParsedToRegisterDays(parsed)
    expect(days).toHaveLength(2)
    expect(days[0]?.day).toBe(1)
    expect(days[0]?.lunchText).toBe('기내식')
    expect(days[1]?.title).toContain('여강고성')
    expect(days[1]?.routeText).toContain('여강고성')
    expect(days[1]?.hotelText).toContain('리장')
  })
})

describe('kyowontour tourEventTabData core tab', () => {
  it('probe tab SSOT — 핵심포인트는 goodsEvtTab_1', () => {
    const core = KYOWONTOUR_TAB_PROBE_IDS.find((t) => t.label === '상품 핵심포인트')
    expect(core?.tabId).toBe(KYOWONTOUR_TAB_CORE_ID)
    expect(KYOWONTOUR_TAB_CORE_ID).toBe('goodsEvtTab_1')
  })

  it('CSP302 fixture — 포함/불포함·싱글룸·가이드팁·핵심포인트', () => {
    const parsed = parseKyowontourCoreTabDetail(CSP302_CORE_TAB1_DETAIL_FIXTURE)
    expect(parsed.includedItems).toContain('왕복항공권')
    expect(parsed.includedItems.some((x) => /숙박/.test(x))).toBe(true)
    expect(parsed.excludedItems.some((x) => /싱글룸/.test(x))).toBe(true)
    expect(parsed.excludedItems.some((x) => /가이드/.test(x))).toBe(true)
    expect(parsed.singleRoomSurchargeAmount).toBe(210_000)
    expect(parsed.mandatoryLocalFee).toBe(50)
    expect(parsed.mandatoryCurrency).toBe('USD')
    expect(parsed.corePoints).toHaveLength(2)
    expect(parsed.corePoints[0]?.title).toBe('여강 고성 야경')
    expect(parsed.mustKnowNotes.length).toBeGreaterThan(0)
  })

  it('CSP302 fixture — goodsEvtTab_3 예약안내·비자', () => {
    const res = parseKyowontourReservationTabDetail(CSP302_RESERVATION_TAB3_DETAIL_FIXTURE)
    expect(res.beforeTourInfo).toContain('예약 진행')
    expect(res.beforeTourInfo).toContain('비자')
    expect(res.etcInfo).toContain('여행 전 준비사항')
  })
})
