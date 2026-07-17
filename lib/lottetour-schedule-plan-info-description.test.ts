import { describe, expect, it } from 'vitest'
import {
  applyLottetourScheduleExpressionToRows,
  composeLottetourScheduleDescription,
  isLottetourVibeFillerDescription,
  summarizeLottetourPlanInfoForDescription,
} from '@/lib/lottetour-register-api-schedule'
import { parseLottetourScheduleDaysFromScheduleAjax } from '@/lib/lottetour-register-api-detail'
import { registerScheduleRouteOrTitleHasShoppingNoise } from '@/lib/register-schedule-description-marketing-guard'

// REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: description vibe; plan_info → route·profile — manifest

describe('lottetour schedule plan_info description', () => {
  it('summarizeLottetourPlanInfoForDescription keeps itinerary body (filter helper)', () => {
    const plan =
      '[가든스 바이 더 베이] 클라우드 포레스트·플라워 돔 관람 후 슈퍼트리 전망대. [센토사] 루지·스카이라이더.'
    expect(summarizeLottetourPlanInfoForDescription(plan)).toMatch(/가든스 바이 더 베이/)
    expect(isLottetourVibeFillerDescription(plan)).toBe(false)
  })

  it('summarizeLottetourPlanInfoForDescription drops Air Seoul marketing perks', () => {
    const plan =
      '[에어서울] 좌석 간격 81cm, 기내 엔터테인먼트 제공. [특전] 인솔자 동행. [수하물] 위탁 15kg. [돗토리 모래언덕] 모래예술 관람 후 [이즈모대사] 참배.'
    const out = summarizeLottetourPlanInfoForDescription(plan)
    expect(out).toMatch(/돗토리|이즈모/)
    expect(out).not.toMatch(/좌석|수하물|특전|엔터테인/)
  })

  it('compose prefers vibe over plan_info place dump', () => {
    const desc = composeLottetourScheduleDescription({
      day: 2,
      maxDay: 5,
      routePlaces: ['싱가포르', '가든스 바이 더 베이'],
      joinedBlob: '싱가포르',
      planInfoRaw:
        '[가든스 바이 더 베이] 2돔·슈퍼트리 관람. [버드 파라다이스] 체험. [머라이언] 외관.',
    })
    expect(desc).not.toMatch(/가든스 바이 더 베이|슈퍼트리|버드\s*파라다이스/)
    expect(isLottetourVibeFillerDescription(desc)).toBe(true)
    expect(desc.split(/[.!?。]/).filter((s) => s.trim().length > 8).length).toBeLessThanOrEqual(3)
  })

  it('applyLottetourScheduleExpressionToRows rewrites plan_info dump to vibe', () => {
    const plan =
      '호텔 조식 후 바다와 사막이 공존하는 모험의 땅 포트스테판 이동【약 3시간 30분 소요】 ▣ 사륜구동차(4WD) 탑승 & 모래썰매 체험 ▣ 돌핀 크루즈'
    const out = applyLottetourScheduleExpressionToRows([
      {
        day: 3,
        title: '시드니',
        description: plan,
        routeText: '시드니 - 포트스테판',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])
    expect(out[0]?.description).not.toMatch(/▣|4WD|모래썰매|소요/)
    expect(isLottetourVibeFillerDescription(out[0]?.description)).toBe(true)
    expect(out[0]?.routeText).toMatch(/포트스테판|시드니/)
    expect(out[0]?.routeText).not.toMatch(/모험의\s*땅|공존하는|▣/)
  })

  it('parse scheduleAjax — description is vibe, not plan_info dump', () => {
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
    expect(days[0]?.description).not.toMatch(/KE645|18:40/)
    expect(days[1]?.description).not.toMatch(/클라우드 포레스트|루지/)
    expect(isLottetourVibeFillerDescription(days[0]?.description)).toBe(true)
    expect(isLottetourVibeFillerDescription(days[1]?.description)).toBe(true)
    expect(days[0]?.description).not.toBe(days[1]?.description)
    expect(days[1]?.routeText).toMatch(/가든스|센토사/)
  })

  it('parse scheduleAjax — shopping strong excluded from routeText', () => {
    const html = `
<dl id="sche_plan_4" class="day_plan">
  <dd>
    <div class="timeline">
      <strong>면세점 1회 쇼핑</strong>
      <strong>요나고</strong>
    </div><!-- //timeline -->
    <div class="table_in">
      <p class="plan_info">[요나고] 시내 이동 후 귀국 준비.</p>
    </div>
  </dd>
</dl><!-- //day_plan -->
`
    const days = parseLottetourScheduleDaysFromScheduleAjax(html)
    expect(days[0]?.routeText).not.toMatch(/면세|쇼핑/)
    expect(days[0]?.routeText).toMatch(/요나고/)
    expect(registerScheduleRouteOrTitleHasShoppingNoise(days[0]?.routeText ?? '')).toBe(false)
  })

  it('AU/NZ day — Port Stephens vibe, not Milford in description; route stays coastal', () => {
    const out = applyLottetourScheduleExpressionToRows([
      {
        day: 3,
        title: '시드니',
        description:
          '호텔 조식 후 포트스테판 이동【약 3시간 30분 소요】 ▣ 사륜구동 & 모래썰매 ▣ 돌핀 크루즈 탑승',
        routeText: '시드니 - 포트스테판',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])
    expect(out[0]?.description).toMatch(/바다와 모래|해안 모험|활기찬/)
    expect(out[0]?.description).not.toMatch(/밀포드|피요르드|▣|모래썰매/)
    expect(out[0]?.routeText).toBe('시드니 - 포트스테판')
  })
})
