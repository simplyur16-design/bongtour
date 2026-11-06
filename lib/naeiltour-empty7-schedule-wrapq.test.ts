/**
 * empty7: naeiltour schedule_wrapq + body POI ??empty7
 */
import { describe, expect, it } from 'vitest'
import { parseNaeiltourScheduleDaysFromTab1 } from '@/lib/naeiltour-register-api-detail'
import { naeiltourFactDaysToRegisterSchedule } from '@/lib/naeiltour-register-api-schedule'

const WRAPQ_FIXTURE = `
<div class="schedule_wrapq">
  <div>1?쇱감 <strong>2027/03/01(?? ?몄쿇-?꾩퓙</strong></div>
  <div class="stay">?숇컯 ?꾩퓙 ?쒕궡 ?명뀛</div>
  <p><img class="point" alt="?ъ씤?? />?띠븘?ъ퓼???쇱냼吏</p>
  <p><img class="point" alt="?ъ씤?? />?띕룄荑?Sky Tree ?꾨쭩?</p>
</div>
<div class="schedule_wrapq">
  <div>2?쇱감 <strong>2027/03/02(?? ?꾩퓙-?붿퐫?섎쭏</strong></div>
  <p>?명뀛 議곗떇??/p>
  <p>?띤솴嫄?/p>
  <p>?띠씠以묎탳</p>
  <p>?띕찓?댁??좉턿</p>
</div>
<div class="schedule_wrapq">
  <div>3?쇱감 <strong>2027/03/03(?? ?꾩퓙-?몄쿇</strong></div>
  <p>議곗떇???띠삤?ㅼ씠諛??대룞 ??洹援?/p>
</div>
`

describe('naeiltour empty7 schedule_wrapq POI extract', () => {
  it('parses schedule_wrapq and keeps body POIs out of meals', () => {
    const days = parseNaeiltourScheduleDaysFromTab1(WRAPQ_FIXTURE)
    expect(days).toHaveLength(3)
    expect(days[0]?.places.join(' ')).toMatch(/?쇱냼吏|Sky Tree|?ㅼ뭅??)
    expect(days[1]?.places.join(' ')).toMatch(/?⑷굅/)
    expect(days[1]?.meals.every((m) => !/?⑷굅|硫붿씠吏/.test(m))).toBe(true)
    const sched = naeiltourFactDaysToRegisterSchedule(days)
    expect(sched[0]?.title).toBeTruthy()
    expect(sched[1]?.description).toMatch(/?⑷굅|?댁쨷援?硫붿씠吏/)
  })
})
