/**
 * REGRESSION-FREEZE[lottetour-register-detail-collect]
 */
import { describe, expect, it } from 'vitest'
import {
  buildLottetourFlightStructuredFromRegisterSources,
  extractLottetourFeesFromExcluded,
  extractLottetourGodScheIdFromBasicAjax,
  extractLottetourIncludedExcludedFromBasicAjax,
  extractLottetourMeetingFromScheduleAjax,
  extractLottetourMustKnowFromBasicAjax,
  extractLottetourOptionalFromSpotListAjax,
  extractLottetourShoppingFromSpotListAjax,
  extractLottetourShoppingVisitCountFromCoreInfo,
  htmlBulletsFromLottetourBlock,
  parseLottetourScheduleDaysFromScheduleAjax,
} from './lottetour-register-api-detail'
import {
  needsLottetourExcludedCollect,
  needsLottetourIncludedCollect,
  needsLottetourIncludedExcludedCollect,
  needsLottetourOptionalCollect,
  needsLottetourScheduleCollect,
} from './lottetour-register-detail-collect'
import { applyLottetourScheduleImageKeywordsToRows } from './lottetour-schedule-image-keyword'
import type { RegisterParsed } from './register-llm-schema-lottetour'

const BASIC_FIXTURE = `
<dl class="dl_box">
  <dt>포함사항</dt>
  <dd id="sche_b01">
    ▣ 왕복 항공료<br />▣ 전일정 호텔 숙박<br />▣ 여행자보험 1억원
  </dd>
</dl>
<dl class="dl_box">
  <dt>불포함사항</dt>
  <dd id="sche_b02">
    ▣ 개인 경비<br />▣ 선내팁 성인 1인 $80<br />▣ 싱글차지 1인 500,000원
  </dd>
</dl>
<dl class="dl_box bt2">
  <dt>예약 시 유의사항</dt>
  <dd id="sche_b03">∨ 예약금 1인 500,000원 결제 필요<br />∨ 잔금은 출발 30일 전 완납</dd>
</dl>
`

const CORE_FIXTURE = `
<table class="table">
  <tbody>
    <tr>
      <th>포함된 쇼핑횟수</th>
      <td style="text-align: center;">2회</td>
    </tr>
  </tbody>
</table>
`

const SHOP_SPOT_FIXTURE = `
<div class="travel_info_cont"><!-- 쇼핑 -->
  <dl class="dl_box">
    <dt>쇼핑정보</dt>
    <dd>
      <p>본 상품에는 총 <span class="txt_red" id="shopCnt">2</span>회의 쇼핑센터 방문 일정이 있습니다.</p>
      <table class="table"><tbody>
        <tr><td>1</td><td class="tal">침향</td><td class="tac">침향샵</td><td class="tac">1시간</td><td class="tac">Y</td></tr>
        <tr><td>2</td><td class="tal">커피</td><td class="tac">커피샵</td><td class="tac">1시간</td><td class="tac">Y</td></tr>
      </tbody></table>
    </dd>
  </dl>
</div><!-- //travel_info_cont : 쇼핑 -->
`

const OPT_SPOT_FIXTURE = `
<div class="travel_info_cont on"><!-- 선택관광 -->
  <dl class="dl_box type03">
    <dt><label>[선택관광] 달랏 관광열차</label></dt>
    <dd>소요 2시간<table><tr><td>USD 30</td></tr></table></dd>
  </dl>
</div><!-- //travel_info_cont : 선택관광 -->
`

const OPT_TABLE_FIXTURE = `
<div class="travel_info_cont on"><!-- 선택관광 -->
  <dl class="dl_box type03"><dt>예약 시 유의 사항</dt><dd><ul><li>선택관광은 상품가격에 불포함</li></ul></dd></dl>
  <dl class="dl_box">
    <dt>선택관광</dt>
    <dd>
      <table class="table"><tbody>
        <tr><td class="tal">서커스</td><td>US$50</td><td>70분</td><td>주변에서 대기</td><td>X</td></tr>
        <tr><td class="tal">발+전신마사지</td><td>US $60</td><td>90분</td><td>근처 자유시간</td><td>X</td></tr>
      </tbody></table>
    </dd>
  </dl>
</div><!-- //travel_info_cont : 선택관광 -->
`

const FLIGHT_SCHEDULE_FIXTURE = `
<div class="departure_info">
  <div class="air_plan">
    <div class="info">KE127</div>
    <div class="air_box blue st">한국<br />출발</div>
    <div class="city_s">07/07 (화) 08:10 <br /><span>인천국제공항 출발</span></div>
    <div class="city_a">07/07 (화) 09:55<br /><span>복주 도착</span></div>
  </div>
</div>
<div class="departure_info">
  <div class="air_plan">
    <div class="info">KE128</div>
    <div class="air_box blue st">한국<br />도착</div>
    <div class="city_s">07/11 (토) 10:55 <br /><span>복주 출발</span></div>
    <div class="city_a">07/11 (토) 14:55<br /><span>인천국제공항 도착</span></div>
  </div>
</div>
`

const MEETING_FIXTURE = `
<dl id ="sche_plan_1" class="day_plan">
  <dd>
    <div class="meet_place">
      <dl class="meet_area">
        <dt>미팅장소</dt>
        <dd>인천공항 T2 A존<p>▣ 시간 : 출발 3시간 전</p></dd>
      </dl>
    </div>
    <div class="timeline">
      <strong>인천</strong>
      <p class="plan_info">◈운항소요시간◈ 5시간 45분</p>
      <strong>푸꾸옥</strong>
    </div>
    <div class="table_in">
      <table><tbody><tr><th class="hotel">숙박</th><td class="hotel_cont">
        <a class="txt_link">래디슨 블루 리조트</a>
      </td></tr><tr><td>
        <span class="txt_black">[조식] 불포함</span>
        <span class="txt_black">[중식] 현지식</span>
        <span class="txt_black">[석식] 호텔식</span>
      </td></tr></tbody></table>
    </div>
  </dd>
</dl><!-- //day_plan -->
`

const GOD_SCHE_FIXTURE = `
<script>
callEvtDetailScheBasDetlLisAjax('B41A260630KE014', '56694');
callScheduleListAjax('B41A260630KE014', '56694');
</script>
`

describe('lottetour register detail collect', () => {
  it('needs schedule collect when empty or title-less', () => {
    expect(needsLottetourScheduleCollect({ schedule: [] } as RegisterParsed)).toBe(true)
    expect(
      needsLottetourScheduleCollect({
        schedule: [{ day: 1, title: '', description: '', imageKeyword: 'x' }],
      } as RegisterParsed),
    ).toBe(true)
    expect(
      needsLottetourScheduleCollect({
        schedule: [{ day: 1, title: '오사카', description: '관광', imageKeyword: 'Osaka' }],
      } as RegisterParsed),
    ).toBe(false)
  })

  it('needs included/excluded when either side missing', () => {
    expect(needsLottetourIncludedExcludedCollect({} as RegisterParsed)).toBe(true)
    expect(
      needsLottetourIncludedCollect({
        excludedItems: ['팁'],
      } as RegisterParsed),
    ).toBe(true)
    expect(
      needsLottetourExcludedCollect({
        includedItems: ['항공권'],
      } as RegisterParsed),
    ).toBe(true)
    expect(
      needsLottetourIncludedExcludedCollect({
        includedText: '항공권',
        excludedText: '팁',
      } as RegisterParsed),
    ).toBe(false)
  })

  it('parses basicAjax included/excluded bullets', () => {
    const { includedItems, excludedItems } = extractLottetourIncludedExcludedFromBasicAjax(BASIC_FIXTURE)
    expect(includedItems.some((x) => /항공료/.test(x))).toBe(true)
    expect(excludedItems.some((x) => /선내팁/.test(x))).toBe(true)
  })

  it('extracts fees from excluded bullets', () => {
    const { excludedItems } = extractLottetourIncludedExcludedFromBasicAjax(BASIC_FIXTURE)
    const fees = extractLottetourFeesFromExcluded(excludedItems)
    expect(fees.guideTipRaw).toMatch(/팁/i)
    expect(fees.singleRoomSurchargeAmount).toBe(500000)
  })

  it('parses must-know from 예약 시 유의사항', () => {
    const items = extractLottetourMustKnowFromBasicAjax(BASIC_FIXTURE)
    expect(items.some((x) => /예약금/.test(x))).toBe(true)
  })

  it('parses shopping visit count from coreInfo', () => {
    expect(extractLottetourShoppingVisitCountFromCoreInfo(CORE_FIXTURE)).toBe(2)
  })

  it('parses shopping rows from spotListAjax', () => {
    const shop = extractLottetourShoppingFromSpotListAjax(SHOP_SPOT_FIXTURE)
    expect(shop.visitCount).toBe(2)
    expect(shop.rows).toHaveLength(2)
    expect(shop.rows[0]?.itemType).toBe('침향')
    expect(shop.rows[1]?.placeName).toBe('커피샵')
  })

  it('parses optional row from spotListAjax label', () => {
    const rows = extractLottetourOptionalFromSpotListAjax(OPT_SPOT_FIXTURE)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toMatch(/달랏 관광열차/)
    expect(rows[0]?.currency).toBe('USD')
  })

  it('htmlBulletsFromLottetourBlock splits ▣ lines', () => {
    const bullets = htmlBulletsFromLottetourBlock('▣ 항공료 포함<br />▣ 선내팁 별도')
    expect(bullets.some((x) => /항공료/.test(x))).toBe(true)
    expect(bullets.some((x) => /선내팁/.test(x))).toBe(true)
  })

  it('extracts godScheId from basicAjax script', () => {
    expect(extractLottetourGodScheIdFromBasicAjax(GOD_SCHE_FIXTURE, 'B41A260630KE014')).toBe('56694')
  })

  it('parses schedule day and meeting from scheduleAjax HTML', () => {
    const days = parseLottetourScheduleDaysFromScheduleAjax(MEETING_FIXTURE)
    expect(days.length).toBe(1)
    expect(days[0]?.day).toBe(1)
    expect(days[0]?.title).toMatch(/인천|1일차/)
    expect(days[0]?.hotelText).toMatch(/래디슨/)
    const meeting = extractLottetourMeetingFromScheduleAjax(MEETING_FIXTURE)
    expect(meeting.meetingInfoRaw).toMatch(/인천공항/)
  })

  it('optional spotList returns empty for NO-option section without rows', () => {
    const html = `<div class="travel_info_cont on"><!-- 선택관광 -->
      <dl class="dl_box type03"><dt>예약 시 유의 사항</dt><dd><ul><li>선택관광은 상품가격에 불포함</li></ul></dd></dl>
    </div><!-- //travel_info_cont : 선택관광 -->`
    expect(extractLottetourOptionalFromSpotListAjax(html)).toEqual([])
  })

  it('parses optional table rows from spotListAjax', () => {
    const rows = extractLottetourOptionalFromSpotListAjax(OPT_TABLE_FIXTURE)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.name).toBe('서커스')
    expect(rows[0]?.currency).toBe('USD')
    expect(rows[1]?.name).toContain('마사지')
  })

  it('LLM hasOptionalTour=false여도 structured 없으면 선택관광 수집', () => {
    expect(
      needsLottetourOptionalCollect({
        hasOptionalPaste: false,
        optionalToursStructured: null,
      }),
    ).toBe(true)
  })

  it('builds flight structured from schedule air_plan and evtList row', () => {
    const fs = buildLottetourFlightStructuredFromRegisterSources({
      scheduleAjaxHtml: FLIGHT_SCHEDULE_FIXTURE,
      evtListRow: {
        depYm: '202607',
        godId: '65715',
        evtCd: 'C11A260707KE015',
        departDate: '2026-07-07',
        returnDate: '2026-07-11',
        departTimeText: '07/07 08:10',
        returnTimeText: '07/11 14:55',
        carrierText: '대한항공',
        gradeText: '정통',
        tourTitleRaw: 'test',
        durationText: '4박5일',
        adultPrice: 809000,
        statusRaw: '예약가능',
        seatsStatusRaw: '16',
        seatCount: 16,
      },
    })
    expect(fs?.airlineName).toBe('대한항공')
    expect(fs?.outbound.flightNo).toBe('KE127')
    expect(fs?.inbound.flightNo).toBe('KE128')
    expect(fs?.outbound.departureTime).toBe('08:10')
    expect(fs?.inbound.departureTime).toBe('10:55')
  })

  it('fills imageKeyword2 for 하문-고랑서 route (Gulangyu primary)', () => {
    const rows = applyLottetourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '고랑서',
          description: '고랑서 관광',
          imageKeyword: 'Gulangyu Island',
          routeText: '하문 - 고랑서',
        },
      ],
      { productTitle: 'Y2627 하문(샤먼),고랑서 4박 5일' },
    )
    expect(rows[0]?.imageKeyword).toBe('Gulangyu Island')
    expect(rows[0]?.imageKeyword2).toMatch(/Xiamen/i)
  })
})
