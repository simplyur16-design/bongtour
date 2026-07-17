/**
 * REGRESSION-FREEZE[register-schedule-route-expression-normalize]
 * REGRESSION-FREEZE[register-schedule-route-text-single-poi-expand]
 */
import { describe, expect, it } from 'vitest'
import {
  expandSingleSegmentPoiRouteTextRows,
  prepareRegisterScheduleRowsForImageKeywordApply,
} from '@/lib/register-schedule-route-text-backfill'

describe('register schedule route expression normalize — 신규 등록', () => {
  it('placeholder 요약을 routeText a–g로 교체', () => {
    const out = prepareRegisterScheduleRowsForImageKeywordApply([
      {
        day: 2,
        title:
          '땅이 끝나고 바다가 시작되는 곳, 까보다로까 - 유럽인들이 살고싶어 하는 최고의 포르투갈 휴양지, 카스카이스',
        description:
          '하루 동안 여러 장면이 자연스럽게 이어지는, 보기와 걷기가 균형 잡힌 알찬 동선입니다. 특정 장소보다 전체적인 흐름과 분위기를 중심으로 여행의 컨셉을 느끼기 좋은 일정입니다.',
        routeText:
          '땅이 끝나고 바다가 시작되는 곳, 까보다로까 - 카스카이스 - 신트라 관광',
      },
    ])
    expect(out[0]?.routeText).toBe('까보다로까 - 카스카이스 - 신트라')
    expect(out[0]?.description).not.toBe(out[0]?.routeText)
    expect(out[0]?.description).toMatch(/하루\s*동안\s*여러\s*장면/)
    expect(out[0]?.title).not.toMatch(/살고싶어/)
  })

  it('단일 POI routeText — 2세그먼트 승격', () => {
    const out = expandSingleSegmentPoiRouteTextRows([
      { day: 7, title: '피사', description: 'generic filler', routeText: '피사' },
      { day: 3, title: '융프라우', description: 'generic', routeText: '융프라우' },
    ])
    expect(out[0]?.routeText).toBe('피사 - 피사 대성당')
    expect(out[1]?.routeText).toBe('융프라우 - 스핑크스 전망대')
  })

  it('단일 요나고 — 한글 다이센 승격, 영어 Mount Daisen 금지', () => {
    // REGRESSION-FREEZE[register-schedule-route-text-single-poi-expand]: 영어 POI 금지 — manifest
    const out = expandSingleSegmentPoiRouteTextRows([
      { day: 4, title: '요나고', description: '귀국', routeText: '요나고' },
    ])
    expect(out[0]?.routeText).toBe('요나고 - 다이센')
    expect(out[0]?.routeText).not.toMatch(/Mount\s*Daisen/i)
  })

  // REGRESSION-FREEZE[register-schedule-route-expression-normalize]: 괌 리조트 자유일 — 인접 아일랜드 route 복사 금지 — manifest
  it('괌 리조트 자유일 — 인접일 아일랜드 관광 routeText 복사 금지', () => {
    const out = prepareRegisterScheduleRowsForImageKeywordApply([
      { day: 1, title: '인천', routeText: '인천', description: '도착' },
      {
        day: 2,
        title: '아일랜드',
        routeText: '아푸간 요새 - 괌 스페인광장 - 이파오비치 - 돈키빌리지',
        description: '관광',
      },
      {
        day: 3,
        title: '전일 리조트 내 부대시설 이용 및 자유시간',
        routeText: '전일 리조트 내 부대시설 이용 및 자유시간',
        description: '휴양',
      },
      {
        day: 4,
        title: '오전 리조트 자유시간',
        routeText: '오전 리조트 내 부대시설 이용 및 자유시간',
        description: '휴양',
      },
      { day: 5, title: '숙박 없음(귀국)', routeText: null, description: '귀국' },
    ])
    expect(out[2]?.routeText).toMatch(/리조트|자유시간/)
    expect(out[2]?.routeText).not.toMatch(/아푸간|돈키빌리지/)
    expect(out[3]?.routeText).not.toMatch(/아푸간|돈키빌리지/)
  })
})
