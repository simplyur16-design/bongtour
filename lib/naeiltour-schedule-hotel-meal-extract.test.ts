/**
 * REGRESSION-FREEZE[naeiltour-schedule-hotel-meal-extract]: stay·조식 본문 추출 — manifest
 * REGRESSION-FREEZE[naeiltour-fee-extract]: 1인실·가이드비 불릿 — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  extractNaeiltourFeesFromBullets,
  parseNaeiltourScheduleDaysFromTab1,
} from '@/lib/naeiltour-register-api-detail'
import { naeiltourFactDaysToRegisterSchedule } from '@/lib/naeiltour-register-api-schedule'

const TAB1_FIXTURE = `
<div class="schedule_wrap">
  <div>1일차 <strong>2026/10/01(목) 인천-푸꾸옥</strong></div>
  <div class="stay">숙박 [저녁/심야 도착] 인터컨티넨탈 푸꾸옥 체크인 &amp; 편안한 휴식 - 밤 도착</div>
  <p>인터컨티넨탈 푸꾸옥 롱비치 조식 뷔페 후 여유로운 오전 시간</p>
</div>
<div class="schedule_wrap">
  <div>2일차 <strong>2026/10/02(금) 푸꾸옥</strong></div>
  <div class="stay">숙박 인터컨티넨탈 푸꾸옥 투숙 및 휴식</div>
  <p>인터컨티넨탈 푸꾸옥 롱비치 조식 뷔페</p>
</div>
`

describe('naeiltour schedule hotel/meal extract', () => {
  it('extracts hotel names and breakfast lines from tab1 HTML', () => {
    const days = parseNaeiltourScheduleDaysFromTab1(TAB1_FIXTURE)
    expect(days).toHaveLength(2)
    expect(days[0]?.hotels[0]).toMatch(/인터컨티넨탈\s*푸꾸옥/)
    expect(days[0]?.meals.some((m) => /조식/.test(m))).toBe(true)
    expect(days[1]?.hotels[0]).toMatch(/인터컨티넨탈\s*푸꾸옥/)
    const sched = naeiltourFactDaysToRegisterSchedule(days)
    expect(sched[0]?.hotelText).toMatch(/인터컨티넨탈/)
    expect(sched[0]?.breakfastText || sched[0]?.mealSummaryText).toBeTruthy()
  })
})

describe('naeiltour fee extract', () => {
  it('parses single room and guide fee from excluded bullets', () => {
    const fees = extractNaeiltourFeesFromBullets(
      ['왕복항공료', '호텔조식'],
      ['1인실 사용시 싱글차지 350,000원', '가이드/기사 경비 USD 50', '여행자보험'],
    )
    expect(fees.singleRoomSurchargeAmount).toBe(350000)
    expect(fees.singleRoomSurchargeRaw).toMatch(/싱글/)
    expect(fees.mandatoryLocalFee).toBe(50)
    expect(fees.mandatoryCurrency).toBe('USD')
    expect(fees.guideTipRaw).toMatch(/가이드/)
  })
})
