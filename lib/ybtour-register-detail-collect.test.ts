/**
 * REGRESSION-FREEZE[ybtour-register-detail-collect]
 */
import { describe, expect, it } from 'vitest'
import {
  extractYbtourIncludedExcluded,
  extractYbtourMeetingFromScheduleTm,
  extractYbtourOptionalFromOptionList,
  extractYbtourOptionalFromTourDetail,
  extractYbtourShoppingFromNoticeAndSchedule,
  extractYbtourShoppingFromShopList,
  htmlBulletsFromYbtourNotice,
  ybtourScheduleBundleToRegisterSchedule,
  buildYbtourFlightStructuredFromTm,
} from './ybtour-register-api-detail'
import {
  needsYbtourIncludedExcludedCollect,
  needsYbtourOptionalCollect,
  needsYbtourScheduleCollect,
} from './ybtour-register-detail-collect'
import type { RegisterParsed } from './register-llm-schema-ybtour'

const AVP_NOTICE_INCL =
  '<p>&middot; 교통 : 왕복 항공료,전용 차량비<br />&middot; 여행자보험 : 1억원 여행자 보험</p>'
const AVP_NOTICE_NOTINCL =
  '<p>&middot; 개인 여행경비<br />&middot; 각종 매너팁(테이블팁, 객실팁, 포터비, 마사지팁 등)</p>'

describe('ybtour register detail collect', () => {
  it('needs schedule collect when empty or title-less', () => {
    expect(needsYbtourScheduleCollect({ schedule: [] } as RegisterParsed)).toBe(true)
    expect(
      needsYbtourScheduleCollect({
        schedule: [{ day: 1, title: '', description: '', imageKeyword: 'x' }],
      } as RegisterParsed),
    ).toBe(true)
    expect(
      needsYbtourScheduleCollect({
        schedule: [{ day: 1, title: '다낭', description: '관광', imageKeyword: 'Da Nang' }],
      } as RegisterParsed),
    ).toBe(false)
  })

  it('needs included/excluded when both missing', () => {
    expect(needsYbtourIncludedExcludedCollect({} as RegisterParsed)).toBe(true)
    expect(
      needsYbtourIncludedExcludedCollect({
        includedText: '항공권',
        excludedText: '팁',
      } as RegisterParsed),
    ).toBe(false)
  })

  it('needs optional collect even when LLM hasOptionalTour=false', () => {
    expect(
      needsYbtourOptionalCollect({
        hasOptionalPaste: false,
        optionalToursStructured: null,
      }),
    ).toBe(true)
    expect(
      needsYbtourOptionalCollect({
        hasOptionalPaste: false,
        optionalToursStructured: null,
        declaresNoOptional: true,
      }),
    ).toBe(false)
  })

  it('parses notice HTML bullets', () => {
    const bullets = htmlBulletsFromYbtourNotice(AVP_NOTICE_INCL)
    expect(bullets.some((b) => /교통/.test(b))).toBe(true)
    expect(bullets.some((b) => /여행자보험/.test(b))).toBe(true)
  })

  it('parses numbered paragraph inclInfo (ALP1122 shape)', () => {
    const incl =
      '<p><span style="color:rgb(128, 0, 128)">1.&nbsp;왕복 그룹 항공권</span></p><p>2.&nbsp;전 일정 호텔 숙박</p>'
    const bullets = htmlBulletsFromYbtourNotice(incl)
    expect(bullets.some((b) => /왕복 그룹 항공권/.test(b))).toBe(true)
    expect(bullets.some((b) => /호텔 숙박/.test(b))).toBe(true)
  })

  it('splits excluded notice on ■ lines', () => {
    const bullets = htmlBulletsFromYbtourNotice(
      '<p>■ 가이드 및 기사 경비 : $50</p><p>■ 기타 개인경비</p>',
    )
    expect(bullets.length).toBeGreaterThanOrEqual(2)
    expect(bullets.some((b) => /가이드/.test(b))).toBe(true)
    expect(bullets.some((b) => /개인경비/.test(b))).toBe(true)
  })

  it('maps schedule detail + tm to RegisterScheduleDay', () => {
    const days = ybtourScheduleBundleToRegisterSchedule(
      [
        { dayNo: 2, foodB: '호텔식', foodL: '소불고기 전골', foodD: '호이안 레스토랑', accommNm: null },
      ],
      [
        { dayNo: 2, tmNo: 1, tmTitle: '호텔 조식 후', tmContent: null, cityNm: '다낭' },
        { dayNo: 2, tmNo: 2, tmTitle: '가이드 미팅 후 호이안 옛도시로 이동', tmContent: null, cityNm: '다낭' },
      ],
    )
    expect(days).toHaveLength(1)
    expect(days[0]?.day).toBe(2)
    expect(days[0]?.title).toContain('호텔 조식')
    expect(days[0]?.lunchText).toContain('소불고기')
    expect(days[0]?.routeText).toBe('다낭')
  })

  it('extracts included/excluded from notice', () => {
    const { includedItems, excludedItems } = extractYbtourIncludedExcluded({
      inclInfo: AVP_NOTICE_INCL,
      notinclInfo: AVP_NOTICE_NOTINCL,
    })
    expect(includedItems.some((x) => /교통/.test(x))).toBe(true)
    expect(excludedItems.some((x) => /매너팁/.test(x))).toBe(true)
  })

  it('extracts meeting from scheduleDetailTm', () => {
    const meeting = extractYbtourMeetingFromScheduleTm([
      {
        meetAirPlace: '인천 국제공항 제2터미널 3층A카운터',
        meetAirTm: '1800',
        meetAirNote: '노랑풍선테이블 3번,4번',
      },
    ])
    expect(meeting.meetingPlaceRaw).toContain('인천')
    expect(meeting.meetingInfoRaw).toContain('18:00')
  })

  it('builds flight structured from schedule tm', () => {
    const fs = buildYbtourFlightStructuredFromTm([
      {
        outFlightNm: 'RS511',
        inFlightNm: 'RS512',
        outDeprtTm: '2055',
        outArrvTm: '2340',
        inDeprtTm: '0040',
        inArrvTm: '0715',
        outDeprtCityNm: '인천',
        outArrvCityNm: '다낭',
        inDeprtCityNm: '다낭',
        inArrvCityNm: '인천',
        evStartDt: '20260711',
        evArriveDt: '20260715',
      },
    ])
    expect(fs?.outbound.flightNo).toBe('RS511')
    expect(fs?.inbound.flightNo).toBe('RS512')
    expect(fs?.outbound.departureTime).toBe('20:55')
  })

  it('accepts airlineName from by-goods carrier', () => {
    const fs = buildYbtourFlightStructuredFromTm(
      [
        {
          outFlightNm: 'ZE601',
          inFlightNm: 'ZE602',
          outDeprtTm: '0855',
          inDeprtTm: '1940',
        },
      ],
      { airlineName: '이스타항공' },
    )
    expect(fs?.airlineName).toBe('이스타항공')
    expect(fs?.outbound.flightNo).toBe('ZE601')
  })

  it('parses shopInfo HTML shopping table', () => {
    const html = `<p>총 2번의 쇼핑센터 방문</p><table>
      <tr><td>회차</td><td>쇼핑 품목</td><td>쇼핑 장소</td><td>소요시간</td><td>환불여부</td></tr>
      <tr><td>1</td><td>파인애플 과자점</td><td>펑왕, 펑리</td><td>50분</td><td>불가능</td></tr>
      <tr><td>2</td><td>게르마늄 상점</td><td>문창</td><td>50분</td><td>불가능</td></tr>
    </table>`
    const shop = extractYbtourShoppingFromNoticeAndSchedule(
      { shopCnt: 2, shopInfo: html },
      [],
    )
    expect(shop.visitCount).toBe(2)
    expect(shop.rows).toHaveLength(2)
    expect(shop.rows[0]?.shoppingItem).toContain('파인애플')
  })

  it('extracts optional tours when trvInfoYn is N', () => {
    const rows = extractYbtourOptionalFromTourDetail([
      { trvInfoNm: '포함 관광', trvInfoYn: 'Y', trvContent: 'included' },
      { trvInfoNm: '[야경투어] 시클로', trvInfoYn: 'N', trvContent: 'optional', optCost: 30 },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toContain('시클로')
  })

  it('filters trvInfoYn N rows without paid optional signals (JHP1109 amenities)', () => {
    const rows = extractYbtourOptionalFromTourDetail([
      { trvInfoNm: '조잔케이 온천', trvInfoYn: 'N', trvContent: 'included onsen' },
      { trvInfoNm: '호텔석식', trvInfoYn: 'N', trvContent: 'buffet' },
      { trvInfoNm: '대게+샤브샤브 + 음주류무제한', trvInfoYn: 'N', trvContent: 'dinner' },
    ])
    expect(rows).toHaveLength(0)
  })

  it('moves single-room and guide-tip lines from incl to excl', () => {
    const ie = extractYbtourIncludedExcluded({
      inclInfo:
        '▣ 왕복항공료<br/>1인 여행 시 독실(싱글룸) 사용 하셔야 하며, 300,000원(전일정) 추가<br/>▣ 가이드/기사 경비 :1인당 ￥4,000엔 (성인/소아 동일적용)',
      notinclInfo: '▣ 개인경비',
    })
    expect(ie.includedItems.some((x) => /싱글|가이드\/기사/.test(x))).toBe(false)
    expect(ie.excludedItems.some((x) => /싱글|300,000/.test(x))).toBe(true)
    expect(ie.excludedItems.some((x) => /가이드\/기사\s*경비/.test(x))).toBe(true)
  })

  it('extracts optional-tour-detail optionList and shopList', () => {
    const opt = extractYbtourOptionalFromOptionList([
      { title: '101 빌딩', cost: '$35/인', useTm: '약 1시간 30분', note: '전망대' },
      { title: '발 마사지', cost: '$30/인', useTm: '약 1시간' },
    ])
    expect(opt).toHaveLength(2)
    expect(opt[0]?.adultPrice).toBe(35)
    const shop = extractYbtourShoppingFromShopList([
      { shopNm: '파인애플 과자점', shopPlace: '펑왕, 펑리', shopTm: '50분', refundNote: '불가능' },
      { shopNm: '게르마늄 상점', shopPlace: '문창', shopTm: '50분', refundNote: '불가능' },
    ])
    expect(shop.visitCount).toBe(2)
    expect(shop.rows[1]?.shoppingItem).toContain('게르마늄')
  })
})
