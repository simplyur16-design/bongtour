/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — hanatour prebuild (dual-slot 회귀만)
 * REGRESSION-FREEZE[hanatour-schedule-image-keyword-landmark]
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyHanatourScheduleImageKeywordsToRows } from '../lib/hanatour-schedule-image-keyword'
import { normScheduleImageKeywordKey } from '../lib/register-schedule-llm-image-keyword-fallback'

describe('hanatour prebuild — imageKeyword dual slot', () => {
  const indiaOpts = { productDestination: 'India' }

  it('본문 타지마할·아그라 성 — kw1/kw2 (Agra LLM → Taj + Agra Fort)', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '아그라',
          description: '타지마할 외부 관람과 아그라 성 방문',
          routeText: '델리 - 아그라',
          imageKeyword: 'Agra',
          imageKeyword2: null,
        },
      ],
      indiaOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Taj Mahal')
    assert.equal(out[0]!.imageKeyword2, 'Agra Fort')
  })

  it('routeText Taj Mahal - Agra Fort — kw2 Agra Fort', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '아그라',
          description: '관광',
          routeText: 'Taj Mahal - Agra Fort',
          imageKeyword: 'Taj Mahal',
          imageKeyword2: null,
        },
      ],
      indiaOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Taj Mahal')
    assert.equal(out[0]!.imageKeyword2, 'Agra Fort')
  })

  it('출발·귀국 일차 — imageKeyword2 null', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '인천 출발 델리 도착',
          routeText: '인천 - 델리',
          imageKeyword: 'Delhi',
          imageKeyword2: 'Taj Mahal',
        },
        {
          day: 5,
          title: '귀국',
          description: '델리 출발 인천 도착',
          routeText: '델리 - 인천',
          imageKeyword: 'Delhi',
          imageKeyword2: 'Agra Fort',
        },
      ],
      indiaOpts,
    )
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword2, null)
    assert.equal(out.find((r) => r.day === 5)!.imageKeyword2, null)
  })

  it('LLM imageKeyword2 유지 — 1순위와 다를 때', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 4,
          title: '야리가다케',
          description: '야리가다케와 신호다카 온천',
          routeText: 'Yarigatake - Hirayu Onsen - Shinhotaka',
          imageKeyword: 'Yarigatake',
          imageKeyword2: 'Shinhotaka Onsen',
        },
      ],
      { productDestination: 'Japan' },
    )
    assert.equal(out[0]!.imageKeyword2, 'Shinhotaka Onsen')
    assert.notEqual(out[0]!.imageKeyword, out[0]!.imageKeyword2)
  })

  it('코타키나발루 — 자유일 예시 선택관광, 귀국일 직전 관광명소', () => {
    const optionalTourNames = [
      'KK 스타 라운지',
      'MD추천 선셋 반딧불이 투어',
      '스페셜포함 툰구압둘라만 해양국립공원 아일랜드 투어',
    ]
    const schedule = [
      {
        day: 1,
        title: '인천 - 국제공항',
        description: '인천 출발 코타키나발루 도착',
        routeText: '인천 - 코타키나발루',
        imageKeyword: 'Kota Kinabalu',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '아일랜드 투어 및 선셋 반딧불 투어',
        description: '스노클링과 반딧불 투어',
        routeText: '코타키나발루 - 아일랜드 투어 - 선셋 반딧불 투어',
        imageKeyword: 'Kota Kinabalu',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '전 일정 자유 시간',
        description: '전 일정 자유 시간으로 시내를 자유롭게 관광할 수 있습니다',
        routeText: '코타키나발루',
        imageKeyword: 'Kota Kinabalu',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '시내 관광 및 KK 스타라운지',
        description: '이슬람 사원 등 시내 관광',
        routeText: '코타키나발루 - 시내 관광 - KK 스타라운지',
        imageKeyword: 'Kota Kinabalu City Mosque',
        imageKeyword2: null,
      },
      {
        day: 5,
        title: '인천 국제공항 도착',
        description: '코타키나발루 출발 인천 도착',
        routeText: '코타키나발루 - 인천',
        imageKeyword: 'Kota Kinabalu',
        imageKeyword2: null,
      },
    ]
    const out = applyHanatourScheduleImageKeywordsToRows(schedule, {
      productDestination: '말레이시아 코타키나발루',
      optionalTourNames,
    })
    assert.ok((out.find((r) => r.day === 3)!.imageKeyword ?? '').length > 0)
    const d4kw = out.find((r) => r.day === 4)!.imageKeyword ?? ''
    const d5kw = out.find((r) => r.day === 5)!.imageKeyword ?? ''
    assert.ok(d4kw.length > 0)
    assert.equal(d5kw, d4kw)
    const d2 = out.find((r) => r.day === 2)!
    assert.ok(d2.imageKeyword.length > 0)
    assert.ok(d2.imageKeyword2 && d2.imageKeyword2.length > 0)
    assert.notEqual(normScheduleImageKeywordKey(d2.imageKeyword), normScheduleImageKeywordKey(d2.imageKeyword2!))
  })

  it('홋카이도 — 1일차 공항 LLM(New Chitose) 대신 죠잔케이, 3일차 오타루 운하·관광일 중복 없음', () => {
    const schedule = [
      {
        day: 1,
        title: '-',
        description:
          '청주 국제공항에서 출발하여 신치토세 공항에 도착합니다. 죠잔케이로 이동하여 온천욕과 함께 휴식을 취합니다. 죠잔케이 네이처 루미나리에 일루미네이션을 감상합니다.',
        routeText: '청주 - 신치토세 - 죠잔케이',
        imageKeyword: 'New Chitose',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '-',
        description: '노보리베츠의 지옥계곡을 방문합니다.',
        routeText: '죠잔케이 - 노보리베츠 - 도야',
        imageKeyword: 'Noboribetsu Jigokudani',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '-',
        description: '오타루 운하 산책과 삿포로 시내 관광.',
        routeText: '도야 - 오타루 - 삿포로',
        imageKeyword: 'Sapporo',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '-',
        description: '삿포로 시내 관광 후 신치토세 공항 경유 귀국',
        routeText: '삿포로 - 신치토세 - 청주',
        imageKeyword: 'Sapporo',
        imageKeyword2: null,
      },
    ]
    const out = applyHanatourScheduleImageKeywordsToRows(schedule, {
      productDestination: '일본 홋카이도',
    })
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword, 'Jozankei')
    assert.equal(out.find((r) => r.day === 2)!.imageKeyword, 'Noboribetsu Jigokudani')
    assert.equal(out.find((r) => r.day === 3)!.imageKeyword, 'Otaru Canal')
    const tourismPrimaries = [1, 2, 3].map((d) =>
      normScheduleImageKeywordKey(out.find((r) => r.day === d)!.imageKeyword),
    )
    assert.equal(new Set(tourismPrimaries).size, tourismPrimaries.length)
    assert.equal(out.find((r) => r.day === 4)!.imageKeyword, out.find((r) => r.day === 3)!.imageKeyword)
  })
})
