/**
 * 11/22 14:30 실행: 25칸 중 13칸이 기록 없이 비어 있던 원인 3가지 회귀 고정.
 * REGRESSION-FREEZE[travel-day-city-representative-1122] / [autofill-kept-gate-defer-1122] / [autofill-own-photo-exclude-1122] — manifest
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { travelDayRepresentativeSights } from '@/lib/register-day-photo-travel-day'
import { sightProfile } from '@/lib/photo-autofill-sight'
import { missingDayFillAction } from '@/lib/register-auto-photo-missing-day'
import { keptDayImagesWhenConfirmedPlaceSkipped } from '@/lib/register-photo-day-confirmed-place'

const ROUTE = readFileSync('app/api/travel/process-images/route.ts', 'utf8')

describe('출국·귀국일 도시 키워드 → 도시 대표 명소', () => {
  // cmvmfmdt8008q3byyczs8w0k0 9/9 귀국일(부다페스트 → 인천)
  const budapestTrip = [
    { day: 1, title: '죄르', routeText: '인천국제공항 출발 / 부다페스트 향발 - 죄르', imageKeyword: 'Budapest Parliament Building', imageUrl: 'https://x/1' },
    { day: 8, title: '부다페스트', routeText: '부다페스트 - 어부의 요새', imageKeyword: 'Danube', imageUrl: 'https://x/8' },
    { day: 9, title: '숙박 없음(귀국)', routeText: '숙박 없음(귀국)', hotelText: null, imageKeyword: 'Budapest', imageUrl: null },
  ]

  it('귀국일 Budapest 는 도시만이라 검색기가 건너뛰던 키워드다', () => {
    expect(sightProfile('Budapest').kind).toBe('city')
    expect(missingDayFillAction(budapestTrip[2]!, 9)).toBe('fill')
  })

  it('귀국일은 마지막 체류지 대표 명소, 다른 날 키워드와 겹치는 명소는 뒤로', () => {
    const rep = travelDayRepresentativeSights(budapestTrip[2]!, budapestTrip, '유럽', 9)
    expect(rep?.kind).toBe('return')
    expect(rep?.city).toBe('Budapest')
    expect(rep!.sights.length).toBeGreaterThan(0)
    expect(rep!.sights[0]).not.toBe('Budapest Parliament Building')
    for (const s of rep!.sights) {
      expect(['sight', 'generic']).toContain(sightProfile(s).kind)
      expect(s).not.toMatch(/airport|plane|airplane|공항|기내/i)
    }
  })

  it('1일차 도시 키워드(인천 출발 - 바르셀로나)는 출국일 = 첫 목적지 대표 명소', () => {
    const rows = [
      { day: 1, title: '인천 출발 · 바르셀로나', routeText: '인천 출발 - 바르셀로나', imageKeyword: 'Barcelona', imageUrl: null },
      { day: 2, title: '바르셀로나', routeText: '바르셀로나 - 사그라다 파밀리아', imageKeyword: 'Sagrada Familia', imageUrl: 'https://x/2' },
    ]
    const rep = travelDayRepresentativeSights(rows[0]!, rows, '스페인', 2)
    expect(rep?.kind).toBe('departure')
    expect(rep?.city).toBe('Barcelona')
    expect(rep!.sights[0]).not.toMatch(/sagrada/i)
  })

  it('명소 키워드·관광일 도시 키워드는 그대로(대체하지 않음)', () => {
    const rows = [
      { day: 1, title: '하버드', routeText: '하버드 대학교', imageKeyword: 'Harvard University Campus', imageUrl: null },
      { day: 2, title: '마드리드', routeText: '마드리드 - 프라도 미술관 - 왕궁', imageKeyword: 'Madrid', imageUrl: null },
      { day: 3, title: '톨레도', routeText: '톨레도 대성당', imageKeyword: 'Toledo Cathedral', imageUrl: null },
    ]
    expect(travelDayRepresentativeSights(rows[0]!, rows, '미국', 3)).toBeNull()
    expect(travelDayRepresentativeSights(rows[1]!, rows, '스페인', 3)).toBeNull()
  })

  it('route 가 strict 채움에서 대표 명소를 sights 로 넘긴다', () => {
    expect(ROUTE).toContain('REGRESSION-FREEZE[travel-day-city-representative-1122]')
    expect(ROUTE).toContain('travelDayRepresentativeSights(sched, workingSchedule, destination, scheduleMaxDay)')
    expect(ROUTE).toContain('...(travelRep ? { sights: travelRep.sights } : {}),')
    expect(ROUTE).toContain("if (!travelRep && dayPhotoContextFromFacts(dayFacts).kind === 'none' && !dayKeywordIsSight) return keep('no_confirmed_sightseeing')")
  })
})

describe('strict 자동 채움은 확인된 관광 없음 관문에서 조용히 건너뛰지 않는다', () => {
  it('하버드(명소 키워드)인데 문맥 none 이라 예전엔 건너뜀', () => {
    const day = {
      day: 6,
      title: '하버드 대학교 · 퀸시 마켓',
      routeText: '하버드 대학교 - MIT (매사추세츠 공과대학) - 보스턴 - 퀸시 마켓',
      description: '하버드 대학교와 MIT를 둘러봅니다.',
      imageKeyword: 'Harvard University Campus',
      imageUrl: '',
    }
    expect(missingDayFillAction(day, 10)).toBe('fill')
    expect(keptDayImagesWhenConfirmedPlaceSkipped(day).skipped).toBe(true)
    expect(ROUTE).toContain('REGRESSION-FREEZE[autofill-kept-gate-defer-1122]')
    expect(ROUTE).toContain('const keptExisting = sched && !travelDay && !strictAutofill ? keptDayImagesWhenConfirmedPlaceSkipped(sched) : null')
    // strictDayPick 은 그대로 문맥·명소 키워드 판정을 한다(명소 아니면 keep)
    expect(ROUTE).toContain('REGRESSION-FREEZE[photo-day-keyword-fill]')
    expect(ROUTE).toContain('gate: `autofill-keep:${unresolvedReason}`.slice(0, 80),')
  })
})

describe('같은 상품 대표·기존 일차 사진은 새 후보에서 뺀다', () => {
  it('exclude 에 대표(보존)·일차 1·2칸 식별키를 넣는다', () => {
    expect(ROUTE).toContain('REGRESSION-FREEZE[autofill-own-photo-exclude-1122]')
    const i = ROUTE.indexOf('REGRESSION-FREEZE[autofill-own-photo-exclude-1122]')
    const block = ROUTE.slice(i, i + 1200)
    expect(block).toContain('if (preserveHero && existingHeroUrl)')
    expect(block).toContain('[row.imageUrl, row.imageSource]')
    expect(block).toContain('[row.imageUrl2, row.imageSource2]')
    expect(block).toContain('strictOwnKeys.add(k)')
    // strictDayPick 은 이 집합에서 exclude 를 만든다
    expect(ROUTE).toContain('const exclude = new Set(strictOwnKeys)')
  })
})
