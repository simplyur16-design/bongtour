import { describe, it, expect } from 'vitest'
import {
  buildFitOriginalRoute,
  buildFitOriginalRoutePromptBlock,
  checkFitItineraryWithinOriginalRoute,
  normalizeOriginalRoutePlace,
} from '@/lib/fit-itinerary-original-route'
import type { FitItineraryGeminiResponse } from '@/lib/fit-itinerary-gemini-parse'

// fit-yb-0017 원문 ItineraryDay(11/01 읽기 결과 그대로)
const YB_ROWS = [
  { day: 1, city: '로스앤젤레스 · THE BROAD 자유관람', summaryTextRaw: '인천에서 출발해 로스앤젤레스에서 도착합니다. 관광 진행과 THE BROAD 자유관람을 둘러봅니다. 첫날 리듬을 맞추며 일정을 이어갑니다.', poiNamesRaw: null, hotelText: 'HOTEL : Holiday Inn Diamond Bar 또는 동급' },
  { day: 2, city: '로스앤젤레스 · 라스베이거스', summaryTextRaw: '유니버설 스튜디오에서 종일 일정을 보냅니다. 테마파크 구역을 오가며 하루를 이어갑니다.', poiNamesRaw: null, hotelText: 'HOTEL : Flamingo 또는 동급' },
  { day: 3, city: '라스베가스 · 레드락캐년', summaryTextRaw: '라스베가스와 세븐매직마운틴을 둘러봅니다. 레드락캐년을 이어서 방문합니다.', poiNamesRaw: null, hotelText: 'HOTEL : Flamingo 또는 동급' },
  { day: 4, city: '라스베가스 · 캐납', summaryTextRaw: '라스베가스와 자이언캐년으로 이동,를 둘러봅니다. 캐납을 이어서 방문합니다.', poiNamesRaw: null, hotelText: 'HOTEL : Quality Inn Kanab 또는 동급' },
  { day: 5, city: '캐납 · 라플린', summaryTextRaw: '캐납과 페이지를 둘러봅니다. 관광진행과 랜드캐년 사우스림을 이어서 방문합니다.', poiNamesRaw: null, hotelText: 'HOTEL : Tropicana Laughlin 또는 동급' },
  { day: 6, city: '라플린 · 베이커스필드', summaryTextRaw: '라플린과 바스토우를 둘러봅니다. 캘리코은광촌과 베이커스필드를 이어서 방문합니다.', poiNamesRaw: null, hotelText: 'HOTEL : Doubletree by Hilton Bakersfield 또는 동급' },
  { day: 7, city: '베이커스필드 · 샌프란시스코', summaryTextRaw: '베이커스필드와 요세미티 폭포, 인스피레이션 포인트를 둘러봅니다. 엘카피탄, 면사포 폭포, 하프 돔 차창과 샌프란시스코를 이어서 방문합니다.', poiNamesRaw: null, hotelText: 'HOTEL : Crowne Plaza Union City 또는 동급' },
  { day: 8, city: '샌프란시스코 · 금문교', summaryTextRaw: '샌프란시스코와 오라클 파크 외관 및 기프트샵을 둘러봅니다. 금문교를 이어서 방문합니다.', poiNamesRaw: null, hotelText: 'HOTEL : Crowne Plaza Union City 또는 동급' },
  { day: 9, city: '샌프란시스코', summaryTextRaw: '샌프란시스코를 둘러봅니다. 샌프란시스코에서 주변을 이어서 둘러봅니다.', poiNamesRaw: null, hotelText: null },
  { day: 10, city: '귀국', summaryTextRaw: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.', poiNamesRaw: null, hotelText: null },
]
const YB_TITLE = '미서부 10일 #3040 #또래여행 #옐링 #3대도시 #관광+자유'

function day(n: number, acts: Array<[string, string, string]>) {
  return {
    dayNumber: n,
    title: `${n}일차`,
    summary: '요약 문장입니다. 요약 문장입니다.',
    dayCityKey: 'x',
    activities: acts.map(([category, title, location], i) => ({ order: i + 1, category, title, description: '설명', location })),
  }
}
const resp = (days: any[]) => ({ title: 't', summary: 's', persona: 'mixed', days }) as unknown as FitItineraryGeminiResponse

describe('fit original route postcheck (1101 문과장 yb-0017)', () => {
  const route = buildFitOriginalRoute(YB_TITLE, YB_ROWS, 10)!

  it('관광+자유 + 원문 도시 3곳 이상이면 원문 경로를 만든다', () => {
    expect(route).toHaveLength(10)
    expect(route[6].places.map(normalizeOriginalRoutePlace)).toEqual(expect.arrayContaining(['요세미티폭포', '샌프란시스코']))
    expect(buildFitOriginalRoutePromptBlock(route)).toContain('7일차: 베이커스필드 · 샌프란시스코')
    expect(buildFitOriginalRoutePromptBlock(route)).toContain('Quality Inn Kanab 또는 동급')
  })

  it('일반 에어텔(관광+자유 아님)·원문 도시 적음 → null(기존 동작)', () => {
    expect(buildFitOriginalRoute('[에어텔전용] 이탈리아 9일', YB_ROWS, 10)).toBeNull()
    expect(buildFitOriginalRoute(YB_TITLE, [{ day: 1, city: '밀라노', summaryTextRaw: '밀라노' }], 9)).toBeNull()
    expect(checkFitItineraryWithinOriginalRoute(resp([day(1, [['attraction', '옐로스톤', '옐로스톤 (Yellowstone)']])]), null)).toEqual([])
  })

  it('원문 밖 장소(옐로스톤·솔트레이크·그리피스)는 실패', () => {
    const issues = checkFitItineraryWithinOriginalRoute(
      resp([
        day(2, [['attraction', '그리피스 천문대', '그리피스 천문대 (Griffith Observatory)']]),
        day(7, [['attraction', '템플 스퀘어', '솔트레이크 템플 스퀘어 (Temple Square)']]),
        day(8, [['attraction', '올드 페이스풀', '옐로스톤 올드 페이스풀 (Old Faithful)']]),
      ]),
      route,
    )
    expect(issues).toEqual(['day2_outside_original_route', 'day7_outside_original_route', 'day8_outside_original_route'])
  })

  it('원문 장소·도시·표기 흔들림(라스베이거스/캐니언/유니버셜)은 통과, 귀국일 관광은 실패', () => {
    expect(
      checkFitItineraryWithinOriginalRoute(
        resp([
          day(1, [['hotel', '호텔', '홀리데이 인'], ['attraction', '더 브로드 미술관', 'THE BROAD (The Broad)']]),
          day(2, [['attraction', '유니버셜 스튜디오 할리우드', '유니버셜 스튜디오 (Universal Studios Hollywood)']]),
          day(3, [['attraction', '세븐 매직 마운틴', '세븐 매직 마운틴 (Seven Magic Mountains)'], ['attraction', '레드락 캐니언', '레드락 캐니언 (Red Rock Canyon)']]),
          day(5, [['attraction', '그랜드캐니언 사우스림', '그랜드캐니언 사우스림 (Grand Canyon South Rim)']]),
          day(9, [['attraction', '샌프란시스코 피셔맨스 워프', '피셔맨스 워프 (Fisherman\'s Wharf)']]),
          day(10, [['transport', '샌프란시스코 공항', '샌프란시스코 공항']]),
        ]),
        route,
      ),
    ).toEqual([])
    expect(
      checkFitItineraryWithinOriginalRoute(resp([day(10, [['attraction', '샌프란시스코 금문교', '금문교 (Golden Gate Bridge)']])]), route),
    ).toEqual(['day10_return_day_has_attraction'])
  })
})
