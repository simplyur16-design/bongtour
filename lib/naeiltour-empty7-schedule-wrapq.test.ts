/**
 * REGRESSION-FREEZE[pending-parser-empty7-1106]: naeiltour schedule_wrapq + body POI — empty7
 */
import { describe, expect, it } from 'vitest'
import { parseNaeiltourScheduleDaysFromTab1 } from '@/lib/naeiltour-register-api-detail'
import { naeiltourFactDaysToRegisterSchedule } from '@/lib/naeiltour-register-api-schedule'

const WRAPQ_FIXTURE = `
<div class="schedule_wrapq">
  <div>1일차 <strong>2027/03/01(월) 인천-도쿄</strong></div>
  <div class="stay">숙박 도쿄 시내 호텔</div>
  <p><img class="point" alt="포인트" />▶아사쿠사 센소지</p>
  <p><img class="point" alt="포인트" />▶도쿄 Sky Tree 전망대</p>
</div>
<div class="schedule_wrapq">
  <div>2일차 <strong>2027/03/02(화) 도쿄-요코하마</strong></div>
  <p>호텔 조식후</p>
  <p>▶황거</p>
  <p>▶이중교</p>
  <p>▶메이지신궁</p>
</div>
<div class="schedule_wrapq">
  <div>3일차 <strong>2027/03/03(수) 도쿄-인천</strong></div>
  <p>조식후 ▶오다이바 이동 후 귀국</p>
</div>
`

describe('naeiltour empty7 schedule_wrapq POI extract', () => {
  it('parses schedule_wrapq and keeps body POIs out of meals', () => {
    const days = parseNaeiltourScheduleDaysFromTab1(WRAPQ_FIXTURE)
    expect(days).toHaveLength(3)
    expect(days[0]?.places.join(' ')).toMatch(/센소지|Sky Tree|스카이/)
    expect(days[1]?.places.join(' ')).toMatch(/황거/)
    expect(days[1]?.meals.every((m) => !/황거|메이지/.test(m))).toBe(true)
    const sched = naeiltourFactDaysToRegisterSchedule(days)
    expect(sched[0]?.title).toBeTruthy()
    expect(sched[1]?.description).toMatch(/황거|이중교|메이지/)
  })
})
