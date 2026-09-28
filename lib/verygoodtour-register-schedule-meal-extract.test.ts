/**
 * REGRESSION-FREEZE[verygoodtour-register-schedule-collect]: scheduleItem 식사 — manifest
 */
import { describe, expect, it } from 'vitest'
import { parseVerygoodScheduleRowsFromDetailHtml } from '@/lib/verygoodtour-register-schedule-item-parse'

const FIXTURE = `
<div id="product-day-1" class="scheduleItem">
  <p class="info date">1일차</p>
  <div class="info location"><div class="inner">인천 - 다낭</div></div>
  <div class="accordion-head"><p>시내 관광</p></div>
  <h4>호텔</h4><p>다낭 시내 호텔</p>
  <h4>식사</h4><p>조식 - 기내식 / 중식 - 현지식 / 석식 - 호텔식</p>
</div>
<div id="product-day-2" class="scheduleItem">
  <p class="info date">2일차</p>
  <div class="info location"><div class="inner">다낭</div></div>
  <h4>호텔</h4><p>다낭 시내 호텔</p>
  <h4>식사</h4><p>조식 호텔식, 중식 현지식, 석식 한식</p>
</div>
<div class="scheduleListEnd"></div>
`

describe('verygoodtour scheduleItem meal extract', () => {
  it('parses hotel and meal fields from h4 blocks', () => {
    const rows = parseVerygoodScheduleRowsFromDetailHtml(FIXTURE)
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows[0]?.hotelText).toMatch(/다낭/)
    expect(rows[0]?.breakfastText || rows[0]?.mealSummaryText).toBeTruthy()
    expect(rows[1]?.dinnerText || rows[1]?.mealSummaryText).toBeTruthy()
  })
})
