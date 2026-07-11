/**
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]
 * 실행: npm run verify:kyowontour-tour-event-tab-opt-shop
 */
import assert from 'node:assert/strict'
import {
  CSP302_CORE_TAB1_DETAIL_FIXTURE,
  CSP302_OPT_SHOP_TAB7_DETAIL_FIXTURE,
  CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE,
  KYOWONTOUR_TAB_CORE_ID,
  KYOWONTOUR_TAB_OPT_SHOP_ID,
  KYOWONTOUR_TAB_SCHEDULE_ID,
  parseKyowontourCoreTabDetail,
  parseKyowontourOptShopTabDetail,
  parseKyowontourScheduleTabDetail,
} from '../lib/kyowontour-tour-event-tab-data'
import { scheduleTabParsedToRegisterDays } from '../lib/kyowontour-register-schedule-collect'

{
  const parsed = parseKyowontourOptShopTabDetail(CSP302_OPT_SHOP_TAB7_DETAIL_FIXTURE)
  assert.equal(KYOWONTOUR_TAB_OPT_SHOP_ID, 'goodsEvtTab_7')
  assert.equal(parsed.shoppingVisitCount, 2, 'shoppingVisitCount')
  assert.equal(parsed.shoppingItems[0]?.itemName, '보이차')
  assert.equal(parsed.optionalTours.length, 6, 'optionalTours.length')
  assert.equal(parsed.optionalTours[5]?.name, '호도협 미니트래킹')
}

{
  assert.equal(KYOWONTOUR_TAB_SCHEDULE_ID, 'goodsEvtTab_2')
  const scheduleTab = parseKyowontourScheduleTabDetail(CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE)
  assert.equal(scheduleTab.dayCount, 2)
  const days = scheduleTabParsedToRegisterDays(scheduleTab)
  assert.equal(days.length, 2)
  assert.equal(days[0]?.routeText, '쿤밍', 'day1 routeText chain')
  assert.equal(days[1]?.routeText, '여강고성 - 대,소석림', 'day2 routeText chain')
  assert.ok(days[1]?.title.includes('여강고성'))
}

{
  assert.equal(KYOWONTOUR_TAB_CORE_ID, 'goodsEvtTab_1')
  const core = parseKyowontourCoreTabDetail(CSP302_CORE_TAB1_DETAIL_FIXTURE)
  assert.equal(core.includedItems.length, 3)
  assert.equal(core.excludedItems.length, 3)
  assert.equal(core.singleRoomSurchargeAmount, 210_000)
  assert.equal(core.corePoints.length, 2)
}

console.log('verify-kyowontour-tour-event-tab-opt-shop: ok')
