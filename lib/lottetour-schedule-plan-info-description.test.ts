import { describe, expect, it } from 'vitest'
import {
  applyLottetourScheduleExpressionToRows,
  composeLottetourScheduleDescription,
  isLottetourVibeFillerDescription,
  summarizeLottetourPlanInfoForDescription,
} from '@/lib/lottetour-register-api-schedule'
import { parseLottetourScheduleDaysFromScheduleAjax } from '@/lib/lottetour-register-api-detail'

// REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: plan_info 일정요약 — manifest

describe('lottetour schedule plan_info description', () => {
  it('summarizeLottetourPlanInfoForDescription keeps itinerary body', () => {
    const plan =
      '[가든스 바이 더 베이] 클라우드 포레스트·플라워 돔 관람 후 슈퍼트리 전망대. [센토사] 루지·스카이라이더.'
    expect(summarizeLottetourPlanInfoForDescription(plan)).toMatch(/가든스 바이 더 베이/)
    expect(isLottetourVibeFillerDescription(plan)).toBe(false)
  })

  it('compose prefers plan_info over vibe filler', () => {
    const desc = composeLottetourScheduleDescription({
      day: 2,
      maxDay: 5,
      routePlaces: ['싱가포르', '가든스 바이 더 베이'],
      joinedBlob: '싱가포르',
      planInfoRaw:
        '[가든스 바이 더 베이] 2돔·슈퍼트리 관람. [버드 파라다이스] 체험. [머라이언] 외관.',
    })
    expect(desc).toMatch(/가든스 바이 더 베이/)
    expect(desc).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
  })

  it('applyLottetourScheduleExpressionToRows does not overwrite plan_info description', () => {
    const plan =
      '인천 출발 KE645 탑승 후 싱가포르 도착. 시내 이동 및 호텔 체크인.'
    const out = applyLottetourScheduleExpressionToRows([
      {
        day: 1,
        title: '싱가포르',
        description: plan,
        routeText: '인천 - 싱가포르',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])
    expect(out[0]?.description).toBe(plan)
    expect(out[0]?.routeText).toMatch(/싱가포르/)
  })

  it('parse scheduleAjax — plan_info becomes day description (not identical vibe)', () => {
    const html = `
<dl id="sche_plan_1" class="day_plan">
  <dd>
    <div class="timeline">
      <strong>인천</strong>
      <strong>싱가포르</strong>
    </div><!-- //timeline -->
    <div class="table_in">
      <p class="plan_info">[대한항공 KE645] 인천 18:40 출발 → 싱가포르 23:55 도착. 시내 호텔 이동.</p>
      <table><tbody><tr><th class="hotel">숙박</th><td class="hotel_cont">
        <a class="txt_link">머큐어 싱가포르</a>
      </td></tr></tbody></table>
    </div>
  </dd>
</dl><!-- //day_plan -->
<dl id="sche_plan_2" class="day_plan">
  <dd>
    <div class="timeline">
      <strong>싱가포르</strong>
    </div><!-- //timeline -->
    <div class="table_in">
      <p class="plan_info">[가든스 바이 더 베이] 클라우드 포레스트·플라워 돔. [센토사] 루지 2회.</p>
      <table><tbody><tr><th class="hotel">숙박</th><td class="hotel_cont">
        <a class="txt_link">머큐어 싱가포르</a>
      </td></tr></tbody></table>
    </div>
  </dd>
</dl><!-- //day_plan -->
`
    const days = parseLottetourScheduleDaysFromScheduleAjax(html)
    expect(days.length).toBeGreaterThanOrEqual(2)
    expect(days[0]?.description).toMatch(/KE645|인천/)
    expect(days[1]?.description).toMatch(/가든스 바이 더 베이/)
    expect(days[0]?.description).not.toBe(days[1]?.description)
    expect(days[0]?.description).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
  })
})
