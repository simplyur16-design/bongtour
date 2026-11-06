/**
 * empty7: naeiltour schedule_wrapq + body POI — empty7
 * Sample: pkg-nl-0020 (good_cd=3JKE21). WRAPQ strings from evidence/pkg-nl-0020-tab1.decoded.html
 * (refetch page sha256 0fb5bae18914e4d4ba68978ec53e9ed451ea17ab424d83aa898d62595288ba0e).
 */
import { describe, expect, it } from 'vitest'
import { parseNaeiltourScheduleDaysFromTab1 } from '@/lib/naeiltour-register-api-detail'
import { naeiltourFactDaysToRegisterSchedule } from '@/lib/naeiltour-register-api-schedule'

/** pkg-nl-0020 first room schedule — full ▶ labels from decoded tab1 (not abbreviated). */
const WRAPQ_FIXTURE = `
<div class="schedule_wrapq">
  <div>1일차 <strong>2027/03/01(월) 인천-도쿄</strong></div>
  <div class="stay">숙박 도쿄 시내 호텔</div>
  <p><img class="point" alt="포인트" />▶아사쿠사 센소지</p>
  <p><img class="point" alt="포인트" />▶도쿄 Sky Tree 전망대 (텐보데크)</p>
</div>
<div class="schedule_wrapq">
  <div>2일차 <strong>2027/03/02(화) 도쿄-요코하마</strong></div>
  <p>호텔 조식후</p>
  <p>▶황거</p>
  <p>▶이중교</p>
  <p>▶히가시교엔 (월,금, 공휴일 휴무- 휴무시 불가)</p>
  <p>▶오다이바</p>
  <p>▶레인보우 브릿지</p>
  <p>▶자유의 여신상</p>
  <p>▶다이바시티에서 자유쇼핑</p>
</div>
<div class="schedule_wrapq">
  <div>3일차 <strong>2027/03/03(수) 도쿄-인천</strong></div>
  <p>조식후</p>
  <p>▶메이지신궁</p>
  <p>▶시부야(澁谷) 미야시타 파크 관광 및 자유쇼핑</p>
</div>
`

describe('naeiltour empty7 schedule_wrapq POI extract', () => {
  it('parses schedule_wrapq and keeps body POIs out of meals (pkg-nl-0020)', () => {
    const days = parseNaeiltourScheduleDaysFromTab1(WRAPQ_FIXTURE)
    expect(days).toHaveLength(3)
    expect(days[0]?.places.join(' ')).toMatch(/센소지|Sky Tree|스카이/)
    expect(days[1]?.places.join(' ')).toMatch(/황거/)
    expect(days[1]?.places.join(' ')).toMatch(/히가시교엔|오다이바/)
    expect(days[1]?.meals.every((m) => !/황거|메이지|히가시교엔/.test(m))).toBe(true)
    expect(days[2]?.places.join(' ')).toMatch(/메이지신궁|시부야/)
    const sched = naeiltourFactDaysToRegisterSchedule(days)
    expect(sched[0]?.title).toBeTruthy()
    expect(sched[1]?.description).toMatch(/황거|이중교/)
  })
})
