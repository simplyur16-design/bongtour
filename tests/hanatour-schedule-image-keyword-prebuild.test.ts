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

  it('routeText Taj Mahal - Agra Fort — kw1/kw2 (3일 middle)', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '인천 출발',
          routeText: 'Incheon - Delhi',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '아그라',
          description: '타지마할 외부 관람과 아그라 성 방문',
          routeText: 'Taj Mahal - Agra Fort',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '귀국',
          description: '귀국',
          routeText: 'Delhi - Incheon',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      indiaOpts,
    )
    const d2 = out.find((r) => r.day === 2)!
    assert.equal(d2.imageKeyword, 'Taj Mahal')
    assert.equal(d2.imageKeyword2, 'Agra Fort')
  })

  it('routeText Taj Mahal - Agra Fort — kw2 Agra Fort (단일 middle)', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '출발',
          routeText: 'Incheon - Delhi',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '아그라',
          description: '관광',
          routeText: 'Taj Mahal - Agra Fort',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '귀국',
          description: '귀국',
          routeText: 'Delhi - Incheon',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      indiaOpts,
    )
    const d2 = out.find((r) => r.day === 2)!
    assert.equal(d2.imageKeyword, 'Taj Mahal')
    assert.equal(d2.imageKeyword2, 'Agra Fort')
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

  it('middle 일차 routeText 2 POI — kw1/kw2 (5일 middle)', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        { day: 1, title: '출발', routeText: 'Incheon - Tokyo', imageKeyword: '', imageKeyword2: null },
        { day: 2, title: '관광', routeText: 'Tokyo - Kyoto', imageKeyword: '', imageKeyword2: null },
        { day: 3, title: '관광', routeText: 'Kyoto - Osaka', imageKeyword: '', imageKeyword2: null },
        {
          day: 4,
          title: '야리가다케',
          description: '야리가다케와 신호다카 온천',
          routeText: 'Yarigatake - Hirayu Onsen - Shinhotaka',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 5, title: '귀국', routeText: 'Osaka - Incheon', imageKeyword: '', imageKeyword2: null },
      ],
      { productDestination: 'Japan' },
    )
    const d4 = out.find((r) => r.day === 4)!
    assert.ok(d4.imageKeyword2)
    assert.notEqual(d4.imageKeyword, d4.imageKeyword2)
  })

  it('코타키나발루 — routeText 슬롯·귀국(N-1) routeText', () => {
    const schedule = [
      {
        day: 1,
        title: '인천 - 국제공항',
        description: '인천 출발 코타키나발루 도착',
        routeText: '인천 - 코타키나발루',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '아일랜드 투어 및 선셋 반딧불 투어',
        description: '스노클링과 반딧불 투어',
        routeText: '코타키나발루 - Mantanani Island - Sunset Fireflies',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '전 일정 자유 시간',
        description: '전 일정 자유 시간으로 시내를 자유롭게 관광할 수 있습니다',
        routeText: '코타키나발루',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '시내 관광 및 KK 스타라운지',
        description: '이슬람 사원 등 시내 관광',
        routeText: 'Kota Kinabalu City Mosque - KK Star Lounge',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 5,
        title: '인천 국제공항 도착',
        description: '코타키나발루 출발 인천 도착',
        routeText: '코타키나발루 - 인천',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    const out = applyHanatourScheduleImageKeywordsToRows(schedule, {
      productDestination: '말레이시아 코타키나발루',
    })
    const d2 = out.find((r) => r.day === 2)!
    assert.ok(d2.imageKeyword.length > 0)
    assert.ok(d2.imageKeyword2 && d2.imageKeyword2.length > 0)
    assert.notEqual(normScheduleImageKeywordKey(d2.imageKeyword), normScheduleImageKeywordKey(d2.imageKeyword2!))
    assert.ok((out.find((r) => r.day === 4)!.imageKeyword ?? '').length > 0)
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword2, null)
    assert.equal(out.find((r) => r.day === 5)!.imageKeyword2, null)
  })

  it('홋카이도 — 1일차 공항 LLM(New Chitose) 대신 죠잔케이, 3일차 오타루 운하·관광일 중복 없음', () => {
    const schedule = [
      {
        day: 1,
        title: '-',
        description:
          '청주 국제공항에서 출발하여 신치토세 공항에 도착합니다. 죠잔케이로 이동하여 온천욕과 함께 휴식을 취합니다. 죠잔케이 네이처 루미나리에 일루미네이션을 감상합니다.',
        routeText: 'Cheongju - New Chitose Airport - Jozankei',
        imageKeyword: 'New Chitose',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '-',
        description: '노보리베츠의 지옥계곡을 방문합니다.',
        routeText: 'Noboribetsu Jigokudani - Toya',
        imageKeyword: 'Noboribetsu Jigokudani',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '-',
        description: '오타루 운하 산책과 삿포로 시내 관광.',
        routeText: 'Toya - Otaru Canal - Sapporo',
        imageKeyword: 'Sapporo',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '-',
        description: '삿포로 시내 관광 후 신치토세 공항 경유 귀국',
        routeText: 'Sapporo - New Chitose Airport - Cheongju',
        imageKeyword: 'Sapporo',
        imageKeyword2: null,
      },
    ]
    const out = applyHanatourScheduleImageKeywordsToRows(schedule, {
      productDestination: '일본 홋카이도',
    })
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword, 'Jozankei')
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword2, null)
    assert.equal(out.find((r) => r.day === 2)!.imageKeyword, 'Noboribetsu Jigokudani')
    assert.match(out.find((r) => r.day === 3)!.imageKeyword ?? '', /Otaru/i)
    const tourismPrimaries = [2, 3].map((d) =>
      normScheduleImageKeywordKey(out.find((r) => r.day === d)!.imageKeyword),
    )
    assert.ok(tourismPrimaries.every((k) => k.length > 0))
    assert.equal(out.find((r) => r.day === 4)!.imageKeyword2, null)
  })

  it('홍콩 3일 — routeText 슬롯·Hong Kong 단독 middle 금지', () => {
    const schedule = [
      {
        day: 1,
        title: '인천 - 홍콩',
        description: '인천 - 홍콩',
        routeText: 'Incheon - Hong Kong - Victoria Peak',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '홍콩 및 마카오 핵심 관광',
        description: '홍콩 - 마카오 - 홍콩',
        routeText: 'Ruins of St. Paul\'s - Senado Square - Venetian Macao',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '홍콩 - 국제공항',
        description: '홍콩 - 인천',
        routeText: 'Wong Tai Sin Temple - Hong Kong - Incheon',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    const out = applyHanatourScheduleImageKeywordsToRows(schedule, {
      productDestination: '홍콩',
    })
    assert.ok((out.find((r) => r.day === 1)!.imageKeyword ?? '').match(/Victoria Peak/i))
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword2, null)
    const d2kw = out.find((r) => r.day === 2)!.imageKeyword ?? ''
    assert.ok(d2kw.length > 0)
    assert.notEqual(normScheduleImageKeywordKey(d2kw), normScheduleImageKeywordKey('Hong Kong'))
    assert.ok((out.find((r) => r.day === 2)!.imageKeyword2 ?? '').length > 0)
    assert.equal(out.find((r) => r.day === 3)!.imageKeyword2, null)
    const primaries = [1, 2, 3].map((d) =>
      normScheduleImageKeywordKey(out.find((r) => r.day === d)!.imageKeyword),
    )
    assert.equal(new Set(primaries).size, primaries.length)
  })

  it('홍콩 3일 — schedule_section (레거시) 미사용 — routeText SSOT', () => {
    const scheduleSectionByDay = new Map<number, string>([
      [
        1,
        `1일차
07/01(수) 인천, 홍콩
소호 거리(SoHo), 타이쿤, 헐리우드 로드, 미드-레벨 에스컬레이터, 리퉁 애비뉴, 빅토리아 피크, 피크트램
08:45 서울 ICN 출발 11:55 홍콩 HKG 도착`,
      ],
    ])
    const schedule = [
      {
        day: 1,
        title: '인천 - 홍콩',
        description: '인천 - 홍콩',
        routeText: 'Incheon - Hong Kong - SoHo Hong Kong',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '홍콩 및 마카오',
        routeText: 'Ruins of St. Paul\'s - Senado Square',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '귀국',
        routeText: 'Wong Tai Sin Temple - Incheon',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    const out = applyHanatourScheduleImageKeywordsToRows(schedule, {
      productDestination: '홍콩',
      scheduleSectionByDay,
    })
    assert.match(out.find((r) => r.day === 1)!.imageKeyword ?? '', /SoHo|Hong Kong/i)
  })

  it('신규 등록 미리보기 경로 — thin schedule + routeText 슬롯', () => {
    const thinRows = [
      { day: 1, title: '인천 - 홍콩', description: '인천 - 홍콩', routeText: 'Incheon - Hong Kong - SoHo Hong Kong', imageKeyword: '', imageKeyword2: null },
      { day: 2, title: '홍콩 - 마카오', description: '홍콩 - 마카오', routeText: "Ruins of St. Paul's - Senado Square", imageKeyword: '', imageKeyword2: null },
      { day: 3, title: '귀국', description: '홍콩 - 인천', routeText: 'Wong Tai Sin Temple - Incheon', imageKeyword: '', imageKeyword2: null },
    ]
    const opts = { supplierKey: 'hanatour', productDestination: '홍콩' }
    const viaPreview = applyRegisterScheduleImageKeywordsForPreview(thinRows, opts)
    const viaAugment = applyHanatourScheduleImageKeywordsToRows(thinRows, {
      productDestination: '홍콩',
    })
    for (let d = 1; d <= 2; d++) {
      assert.equal(viaPreview.find((r) => r.day === d)!.imageKeyword, viaAugment.find((r) => r.day === d)!.imageKeyword)
      assert.ok(String(viaPreview.find((r) => r.day === d)!.imageKeyword ?? '').length > 0)
    }
    assert.equal(viaPreview.find((r) => r.day === 3)!.imageKeyword2, null)
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
      { day: 1, title: '인천 - 홍콩', description: '인천 - 홍콩', routeText: 'SoHo Hong Kong - Victoria Peak', imageKeyword: '', imageKeyword2: null },
      { day: 2, title: '홍콩 - 마카오', description: '홍콩 - 마카오 - 홍콩', routeText: "Ruins of St. Paul's - Senado Square", imageKeyword: '', imageKeyword2: null },
      { day: 3, title: '귀국', description: '홍콩 - 인천', routeText: 'Wong Tai Sin Temple - Incheon', imageKeyword: '', imageKeyword2: null },
    ]
    const sectionMap = resolveHanatourRegisterScheduleSectionByDay({ parsed: { detailBodyStructured: detailBody as never } })
    const out = applyRegisterScheduleImageKeywordsForPreview(schedule, {
      supplierKey: 'hanatour',
      productDestination: '홍콩',
      scheduleSectionByDay: sectionMap,
    })
    assert.match(out.find((r) => r.day === 1)!.imageKeyword ?? '', /SoHo/i)
    assert.ok(String(out.find((r) => r.day === 2)!.imageKeyword ?? '').length > 0)
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
      { day: 1, title: '출발', routeText: 'Incheon - Hong Kong', imageKeyword: '', imageKeyword2: null },
      { day: 2, title: '관광', routeText: "Ruins of St. Paul's - Senado Square", imageKeyword: '', imageKeyword2: null },
      {
        day: 3,
        title: '기본상품 성인 1 - 156 - 200원 아동 949',
        description: '홍콩 - 인천',
        routeText: 'Wong Tai Sin Temple - Incheon',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    const enriched = enrichHanatourRegisterPreviewScheduleRowsFromSection(polluted, detailBody as never)
    assert.match(enriched.find((r) => r.day === 3)!.title ?? '', /홍콩|07\/03/)
    const sectionMap = resolveHanatourRegisterScheduleSectionByDay({ parsed: { detailBodyStructured: detailBody as never } })
    const out = applyRegisterScheduleImageKeywordsForPreview(enriched, {
      supplierKey: 'hanatour',
      productDestination: '홍콩',
      scheduleSectionByDay: sectionMap,
    })
    assert.match(out.find((r) => r.day === 3)!.title ?? '', /홍콩|07\/03/)
    assert.ok(String(out.find((r) => r.day === 2)!.imageKeyword ?? '').length > 0)
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

  it('trip 전체 — 일자 간 imageKeyword·imageKeyword2 중복 시 route 차순위 명소', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        { day: 1, title: '출발', routeText: 'Incheon - Delhi', imageKeyword: '', imageKeyword2: null },
        {
          day: 2,
          title: '아그라',
          description: '타지마할과 아그라 성',
          routeText: 'Taj Mahal - Agra Fort',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '델리',
          description: '휴마윤의 무덤',
          routeText: 'Agra Fort - Humayun Tomb - Delhi',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 4, title: '귀국', routeText: 'Delhi - Incheon', imageKeyword: '', imageKeyword2: null },
      ],
      { productDestination: 'India' },
    )
    const keys = out
      .filter((r) => Number(r.day) > 0 && Number(r.day) < 4)
      .flatMap((r) => [r.imageKeyword, r.imageKeyword2].filter(Boolean))
      .map((k) => normScheduleImageKeywordKey(String(k)))
    const unique = new Set(keys)
    assert.equal(unique.size, keys.length)
    const d3 = out.find((r) => r.day === 3)!
    assert.notEqual(normScheduleImageKeywordKey(String(d3.imageKeyword)), normScheduleImageKeywordKey('Agra Fort'))
  })

  it('flight-only detailBodyStructured stub (sections missing) — gather/enrich do not throw', () => {
    const stub = {
      flightStructured: {
        airlineName: '아시아나항공',
        outbound: { flightNo: 'OZ202' },
        inbound: { flightNo: 'OZ203' },
      },
    }
    const byDay = gatherHanatourScheduleSectionBodiesByDay(stub as never)
    assert.equal(byDay.size, 0)
    const sectionMap = resolveHanatourRegisterScheduleSectionByDay({
      parsed: { detailBodyStructured: stub as never },
    })
    assert.equal(sectionMap, null)
    const rows = enrichHanatourRegisterPreviewScheduleRowsFromSection(
      [{ day: 1, title: 'Day 1', description: '관광', routeText: null }],
      stub as never,
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.title, 'Day 1')
  })
})
