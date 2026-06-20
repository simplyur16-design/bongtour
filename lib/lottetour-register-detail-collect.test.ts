/**
 * REGRESSION-FREEZE[lottetour-register-detail-collect]
 */
import { describe, expect, it } from 'vitest'
import {
  extractLottetourFeesFromExcluded,
  extractLottetourGodScheIdFromBasicAjax,
  extractLottetourIncludedExcludedFromBasicAjax,
  extractLottetourMeetingFromScheduleAjax,
  extractLottetourMustKnowFromBasicAjax,
  extractLottetourOptionalFromSpotListAjax,
  extractLottetourShoppingVisitCountFromCoreInfo,
  htmlBulletsFromLottetourBlock,
  parseLottetourScheduleDaysFromScheduleAjax,
} from './lottetour-register-api-detail'
import {
  needsLottetourIncludedExcludedCollect,
  needsLottetourScheduleCollect,
} from './lottetour-register-detail-collect'
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

  it('needs included/excluded when both missing', () => {
    expect(needsLottetourIncludedExcludedCollect({} as RegisterParsed)).toBe(true)
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
})
