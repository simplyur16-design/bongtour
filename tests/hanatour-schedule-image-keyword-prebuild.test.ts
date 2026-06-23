/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — hanatour prebuild (dual-slot 회귀만)
 * REGRESSION-FREEZE[hanatour-schedule-image-keyword-landmark]
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyHanatourScheduleImageKeywordsToRows } from '../lib/hanatour-schedule-image-keyword'
import { applyRegisterScheduleImageKeywordsForPreview } from '../lib/register-schedule-image-keywords-preview'
import {
  gatherHanatourScheduleSectionBodiesByDay,
  resolveHanatourRegisterScheduleSectionByDay,
  enrichHanatourRegisterPreviewScheduleRowsFromSection,
} from '../lib/hanatour-schedule-section-by-day'
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

  it('홍콩 3일 — schedule_section 원문에서 SoHo·성당·웡타이신, Hong Kong 단독 1순위 금지', () => {
    const scheduleSectionByDay = new Map<number, string>([
      [
        1,
        `1일차
07/01(수) 인천, 홍콩
소호 거리(SoHo), 타이쿤, 헐리우드 로드, 미드-레벨 에스컬레이터, 리퉁 애비뉴, 빅토리아 피크, 피크트램
08:45 서울 ICN 출발 11:55 홍콩 HKG 도착`,
      ],
      [
        2,
        `2일차
07/02(목) 홍콩, 마카오
침사추이 해변 산책로, 성 바울 성당 유적, 세나두 광장, 육포 및 쿠키 거리, 베네시안 마카오 리조트
홍콩-마카오로 이동`,
      ],
      [
        3,
        `3일차
07/03(금) 홍콩, 인천
웡타이신 사원
13:15 홍콩 HKG 출발 18:05 서울 ICN 도착`,
      ],
    ])
    const schedule = [
      {
        day: 1,
        title: '인천 - 홍콩',
        description: '인천 - 홍콩',
        routeText: '인천 - 홍콩',
        imageKeyword: 'Hong Kong',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '홍콩 및 마카오 핵심 관광',
        description: '홍콩 - 마카오 - 홍콩',
        routeText: '홍콩 - 마카오 - 홍콩',
        imageKeyword: 'Ruins of St. Paul\'s',
        imageKeyword2: 'Hong Kong',
      },
      {
        day: 3,
        title: '홍콩 - 국제공항',
        description: '홍콩 - 인천',
        routeText: '홍콩 - 인천',
        imageKeyword: 'Hong Kong',
        imageKeyword2: null,
      },
    ]
    const out = applyHanatourScheduleImageKeywordsToRows(schedule, {
      productDestination: '홍콩',
      scheduleSectionByDay,
    })
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword, 'SoHo Hong Kong')
    const d2kw = out.find((r) => r.day === 2)!.imageKeyword ?? ''
    assert.ok(d2kw.length > 0)
    assert.notEqual(normScheduleImageKeywordKey(d2kw), normScheduleImageKeywordKey('Hong Kong'))
    assert.equal(out.find((r) => r.day === 3)!.imageKeyword, 'Wong Tai Sin Temple')
    const primaries = [1, 2, 3].map((d) =>
      normScheduleImageKeywordKey(out.find((r) => r.day === d)!.imageKeyword),
    )
    assert.equal(new Set(primaries).size, primaries.length)
    const d2kw2 = out.find((r) => r.day === 2)!.imageKeyword2 ?? ''
    assert.ok(d2kw2.length > 0)
    assert.notEqual(normScheduleImageKeywordKey(d2kw2), normScheduleImageKeywordKey('Hong Kong'))
  })

  it('신규 등록 미리보기 경로 — thin schedule + scheduleSectionByDay = augment와 동일', () => {
    const scheduleSectionByDay = new Map<number, string>([
      [1, '1일차 소호 거리(SoHo), 빅토리아 피크, ICN 출발 HKG 도착'],
      [2, '2일차 성 바울 성당 유적, 세나두 광장'],
      [3, '3일차 웡타이신 사원, HKG 출발 ICN 도착'],
    ])
    const thinRows = [
      { day: 1, title: '인천 - 홍콩', description: '인천 - 홍콩', routeText: '인천 - 홍콩', imageKeyword: 'Hong Kong', imageKeyword2: null },
      { day: 2, title: '홍콩 - 마카오', description: '홍콩 - 마카오 - 홍콩', routeText: '홍콩 - 마카오 - 홍콩', imageKeyword: 'Hong Kong', imageKeyword2: null },
      { day: 3, title: '귀국', description: '홍콩 - 인천', routeText: '홍콩 - 인천', imageKeyword: 'Hong Kong', imageKeyword2: null },
    ]
    const opts = { supplierKey: 'hanatour', productDestination: '홍콩', scheduleSectionByDay }
    const viaPreview = applyRegisterScheduleImageKeywordsForPreview(thinRows, opts)
    const viaAugment = applyHanatourScheduleImageKeywordsToRows(thinRows, {
      productDestination: '홍콩',
      scheduleSectionByDay,
    })
    for (let d = 1; d <= 3; d++) {
      assert.equal(viaPreview.find((r) => r.day === d)!.imageKeyword, viaAugment.find((r) => r.day === d)!.imageKeyword)
      assert.notEqual(normScheduleImageKeywordKey(viaPreview.find((r) => r.day === d)!.imageKeyword), normScheduleImageKeywordKey('Hong Kong'))
    }
  })

  it('thin schedule_section + normalizedRaw — POI 명소 줄 복구 후 SoHo·웡타이신', () => {
    const normalizedRaw = `1일차
07/01(수) 인천, 홍콩
소호 거리(SoHo), 타이쿤, 빅토리아 피크, 피크트램
2일차
07/02(목) 홍콩, 마카오
성 바울 성당 유적, 세나두 광장
3일차
07/03(금) 홍콩, 인천
웡타이신 사원`
    const detailBody = {
      normalizedRaw,
      sections: [
        {
          type: 'schedule_section' as const,
          text: `1일차\n07/01(수) 인천, 홍콩\n2일차\n07/02(목) 홍콩, 마카오\n3일차\n07/03(금) 홍콩, 인천`,
        },
      ],
    }
    const byDay = gatherHanatourScheduleSectionBodiesByDay(detailBody as never)
    assert.match(byDay.get(1) ?? '', /SoHo|소호/)
    assert.match(byDay.get(3) ?? '', /웡타이신|Wong/i)

    const schedule = [
      { day: 1, title: '인천 - 홍콩', description: '인천 - 홍콩', routeText: '인천 - 홍콩', imageKeyword: 'Hong Kong', imageKeyword2: null },
      { day: 2, title: '홍콩 - 마카오', description: '홍콩 - 마카오 - 홍콩', routeText: '홍콩 - 마카오 - 홍콩', imageKeyword: "Ruins of St. Paul's", imageKeyword2: 'Hong Kong' },
      { day: 3, title: '귀국', description: '홍콩 - 인천', routeText: '홍콩 - 인천', imageKeyword: 'Hong Kong', imageKeyword2: null },
    ]
    const sectionMap = resolveHanatourRegisterScheduleSectionByDay({ parsed: { detailBodyStructured: detailBody as never } })
    const out = applyRegisterScheduleImageKeywordsForPreview(schedule, {
      supplierKey: 'hanatour',
      productDestination: '홍콩',
      scheduleSectionByDay: sectionMap,
    })
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword, 'SoHo Hong Kong')
    assert.equal(out.find((r) => r.day === 3)!.imageKeyword, 'Wong Tai Sin Temple')
  })

  it('LLM Victoria Peak — schedule_section 명소 등장 순이 LLM보다 우선', () => {
    const scheduleSectionByDay = new Map<number, string>([
      [
        2,
        `2일차
07/02(목) 홍콩, 마카오
침사추이 해변, 성 바울 성당 유적, 세나두 광장`,
      ],
    ])
    const schedule = [
      {
        day: 2,
        title: '홍콩 및 마카오 핵심 관광',
        description: '홍콩 - 마카오 - 홍콩',
        routeText: '홍콩 - 마카오 - 홍콩',
        imageKeyword: 'Victoria Peak',
        imageKeyword2: null,
      },
    ]
    const out = applyHanatourScheduleImageKeywordsToRows(schedule, {
      productDestination: '홍콩',
      scheduleSectionByDay,
    })
    assert.notEqual(normScheduleImageKeywordKey(out[0]!.imageKeyword), normScheduleImageKeywordKey('Victoria Peak'))
    assert.notEqual(normScheduleImageKeywordKey(out[0]!.imageKeyword), normScheduleImageKeywordKey('Hong Kong'))
  })

  it('가격표 title 오염 + normalizedRaw — enrich 후 귀국일 웡타이신', () => {
    const normalizedRaw = `3일차
07/03(금) 홍콩, 인천
웡타이신 사원`
    const detailBody = {
      normalizedRaw,
      sections: [
        {
          type: 'schedule_section' as const,
          text: `3일차\n07/03(금) 홍콩, 인천\n웡타이신 사원`,
        },
      ],
    }
    const polluted = [
      {
        day: 3,
        title: '기본상품 성인 1 - 156 - 200원 아동 949',
        description: '홍콩 - 인천',
        routeText: '홍콩 - 인천',
        imageKeyword: 'Victoria Peak',
        imageKeyword2: null,
      },
    ]
    const enriched = enrichHanatourRegisterPreviewScheduleRowsFromSection(polluted, detailBody as never)
    assert.match(enriched[0]!.title ?? '', /홍콩|07\/03/)
    const sectionMap = resolveHanatourRegisterScheduleSectionByDay({ parsed: { detailBodyStructured: detailBody as never } })
    const out = applyRegisterScheduleImageKeywordsForPreview(enriched, {
      supplierKey: 'hanatour',
      productDestination: '홍콩',
      scheduleSectionByDay: sectionMap,
    })
    assert.equal(out[0]!.imageKeyword, 'Wong Tai Sin Temple')
  })

  it('본문 일정 SSOT — LLM generic·가격 title 대신 schedule_section 표현·식사 유지', async () => {
    const { mergeHanatourBodyFirstScheduleRows } = await import('../lib/parse-and-register-hanatour-schedule')
    const bodyRows = [
      {
        day: 1,
        title: '07/01(수) 인천, 홍콩',
        description: '소호 거리(SoHo), 타이쿤, 빅토리아 피크',
        routeText: '인천 - 홍콩',
        imageKeyword: '',
        breakfastText: null,
        lunchText: '기내식',
        dinnerText: '호텔식',
        mealSummaryText: '조: - / 중: 기내식 / 석: 호텔식',
        hotelText: '홍콩 호텔',
      },
      {
        day: 3,
        title: '07/03(금) 홍콩, 인천',
        description: '웡타이신 사원',
        routeText: '홍콩 - 인천',
        imageKeyword: '',
        breakfastText: '호텔식',
        lunchText: null,
        dinnerText: '기내식',
        mealSummaryText: null,
        hotelText: null,
      },
    ]
    const llmRows = [
      {
        day: 1,
        title: '인천 - 국제공항',
        description: '인천 국제공항에서 출발하여 홍콩으로 이동합니다. 숙소에서 휴식.',
        routeText: '인천 - 홍콩',
        imageKeyword: 'Hong Kong',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '홍콩 및 마카오 핵심 관광',
        description: '홍콩과 마카오의 주요 명소를 둘러봅니다.',
        routeText: '홍콩 - 마카오 - 홍콩',
        imageKeyword: 'Victoria Peak',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '상품가격',
        description: '귀국을 위해 공항으로 이동합니다.',
        routeText: '홍콩 - 인천',
        imageKeyword: 'Victoria Peak',
        imageKeyword2: null,
      },
    ]
    const merged = mergeHanatourBodyFirstScheduleRows(bodyRows as never, llmRows as never)
    const d1 = merged.find((r) => r.day === 1)!
    assert.match(d1.description, /SoHo|소호/)
    assert.equal(d1.lunchText, '기내식')
    assert.equal(d1.dinnerText, '호텔식')
    assert.notEqual(d1.title, '인천 - 국제공항')
    const d3 = merged.find((r) => r.day === 3)!
    assert.match(d3.description, /웡타이신/)
    assert.notEqual(d3.title, '상품가격')
    assert.equal(d3.breakfastText, '호텔식')
  })
})
