/**
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]
 */
import { describe, expect, it } from 'vitest'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  applyDomesticHubOnlyDepartureReturnAdjacentKeywords,
  enforceRegisterScheduleTripUniqueImageKeywords,
  ensureDepartureReturnVisitCityKeywords,
  fillRegisterScheduleMiddleDayImageKeywordGaps,
  sanitizeRegisterScheduleImageKeywordsOnDomesticHubOnlyDays,
} from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { MODETOUR_BA_NA_HILLS_REGRESSION_ROWS } from '@/lib/schedule-image-keyword-dual-slot-contract'
import { mapDestination } from '@/lib/pexels-keyword'

describe('enforceRegisterScheduleTripUniqueImageKeywords', () => {
  it('replaces duplicate primary with next unused route landmark', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      {
        day: 1,
        routeText: '인천 - 돗토리 - 미즈키시게루 로드',
        imageKeyword: 'Tottori',
        imageKeyword2: null,
      },
      {
        day: 2,
        routeText: '돗토리 - 미즈키시게루 로드',
        imageKeyword: 'Tottori',
        imageKeyword2: null,
      },
    ])
    expect(out[0]!.imageKeyword).toMatch(/Tottori/i)
    expect(out[1]!.imageKeyword).not.toMatch(/^Tottori$/i)
    expect(out[0]!.imageKeyword).not.toBe(out[1]!.imageKeyword)
  })

  it('clears duplicate when no alternate landmark on same route', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      { day: 1, routeText: '인천 공항 출발', imageKeyword: 'Incheon', imageKeyword2: null },
      { day: 2, routeText: '레 - 레 왕궁', imageKeyword: 'Leh Palace Ladakh', imageKeyword2: null },
      { day: 3, routeText: '레 - 레 왕궁', imageKeyword: 'Leh Palace Ladakh', imageKeyword2: null },
      { day: 4, routeText: '인천 공항 귀국', imageKeyword: 'Incheon', imageKeyword2: null },
    ])
    expect(out.find((r) => r.day === 2)!.imageKeyword).toMatch(/Leh/i)
    expect(String(out.find((r) => r.day === 3)!.imageKeyword ?? '')).not.toBe(
      String(out.find((r) => r.day === 2)!.imageKeyword ?? ''),
    )
  })

  it('domestic-hub-only day — adjacent POI refill (departure forward / return backward)', () => {
    const out = applyDomesticHubOnlyDepartureReturnAdjacentKeywords([
      {
        day: 1,
        routeText: '인천',
        title: '-',
        description: '인천',
        imageKeyword: 'Incheon International Airport',
        imageKeyword2: null,
      },
      {
        day: 2,
        routeText: '달랏 - 다딴라폭포',
        title: '-',
        description: '달랏',
        imageKeyword: 'Datanla Waterfalls',
        imageKeyword2: 'Da Lat Vietnam Highland',
      },
      {
        day: 5,
        routeText: '인천',
        title: '-',
        description: '인천',
        imageKeyword: 'Nha Trang',
        imageKeyword2: null,
      },
      {
        day: 4,
        routeText: '나트랑 - 포나가 참 사원 - 롱선사',
        title: '-',
        description: '나트랑',
        imageKeyword: 'Nha Trang',
        imageKeyword2: 'Long Son Pagoda',
      },
    ])
    expect(out.find((r) => r.day === 1)!.imageKeyword).toMatch(/Datanla|Da Lat/i)
    expect(out.find((r) => r.day === 5)!.imageKeyword).toMatch(/Po Nagar|포/i)
    expect(out.find((r) => r.day === 5)!.imageKeyword).not.toMatch(/Nha Trang/i)
  })

  it('empty route departure day — forward-fill from next tourism day', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, routeText: '', title: '-', description: 'placeholder', imageKeyword: '', imageKeyword2: null },
        {
          day: 2,
          routeText: '테살로니키 - 메테오라',
          title: '-',
          description: '-',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      { supplierKey: 'hanatour', productDestination: 'Greece', travelScope: 'package' },
    )
    expect(String(out.find((r) => r.day === 1)?.imageKeyword ?? '')).toMatch(/Meteora|Thessaloniki|White Tower/i)
  })

  it('return day with hub-only route — last visit city from prior tourism day', () => {
    const out = ensureDepartureReturnVisitCityKeywords(
      [
        {
          day: 1,
          routeText: '인천 - 프라하',
          title: '-',
          description: '-',
          imageKeyword: 'Prague',
          imageKeyword2: null,
        },
        {
          day: 2,
          routeText: '체스키크룸로프 - 잘츠부르크',
          title: '-',
          description: '-',
          imageKeyword: 'Cesky Krumlov Castle Czech Republic',
          imageKeyword2: 'Hohensalzburg Fortress Salzburg',
        },
        {
          day: 3,
          routeText: '인천 - [프라하 - 인천 : 약 11시간 20분 소요]',
          title: '-',
          description: '-',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      'Czech Republic',
    )
    expect(String(out.find((r) => r.day === 3)?.imageKeyword ?? '')).toMatch(/Prague|Salzburg|Cesky/i)
    expect(String(out.find((r) => r.day === 3)?.imageKeyword2 ?? '')).toBe('')
  })

  it('departure day 인천 only — first visit city from next day route', () => {
    const out = ensureDepartureReturnVisitCityKeywords(
      [
        { day: 1, routeText: '인천', title: '-', description: '-', imageKeyword: '', imageKeyword2: null },
        { day: 2, routeText: '마드리드 - 톨레도', title: '-', description: '-', imageKeyword: '', imageKeyword2: null },
        { day: 3, routeText: '세고비아', title: '-', description: '-', imageKeyword: '', imageKeyword2: null },
      ],
      'Spain',
    )
    expect(String(out.find((r) => r.day === 1)?.imageKeyword ?? '')).toMatch(/Madrid|Toledo|Segovia/i)
  })

  it('return day — trip-wide used 키워드(Zaisan) 재사용 금지', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          routeText: '아리야발 사원 - 테렐지',
          title: '-',
          description: '-',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          routeText: '테렐지 국립공원',
          title: '-',
          description: '-',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          routeText: '자이승 승전탑 - 수흐바타르 광장',
          title: '-',
          description: '-',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 4, routeText: '', title: '-', description: '-', imageKeyword: '', imageKeyword2: null },
      ],
      { supplierKey: 'hanatour', productDestination: '몽골', travelScope: 'package' },
    )
    const d3 = out.find((r) => r.day === 3)!
    const d4 = out.find((r) => r.day === 4)!
    const used = new Set<string>()
    for (const row of out) {
      for (const slot of [row.imageKeyword, row.imageKeyword2]) {
        const nk = normScheduleImageKeywordKey(String(slot ?? '').trim())
        if (nk) {
          expect(used.has(nk)).toBe(false)
          used.add(nk)
        }
      }
    }
    expect(String(d4.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
    expect(normScheduleImageKeywordKey(String(d3.imageKeyword ?? ''))).not.toBe(
      normScheduleImageKeywordKey(String(d4.imageKeyword ?? '')),
    )
  })

  it('ensureDepartureReturn — sanitized single-city departure route still fills visit city', () => {
    const out = ensureDepartureReturnVisitCityKeywords(
      [
        { day: 1, routeText: '오사카', imageKeyword: '', imageKeyword2: null },
        { day: 2, routeText: '오사카 - 교토 - 오사카', imageKeyword: 'Kyoto', imageKeyword2: 'Osaka' },
        { day: 3, routeText: '오사카 - 인천', imageKeyword: '', imageKeyword2: null },
      ],
      '오사카',
    )
    expect(String(out.find((r) => r.day === 1)?.imageKeyword ?? '')).toMatch(/Osaka/i)
    expect(String(out.find((r) => r.day === 2)?.imageKeyword2 ?? '')).toBe('')
  })

  it('Osaka 3-day — departure visit city does not duplicate middle kw2', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, routeText: '인천 - 오사카', imageKeyword: '', imageKeyword2: null },
        { day: 2, routeText: '오사카 - 교토 - 오사카', imageKeyword: '', imageKeyword2: null },
        { day: 3, routeText: '오사카 - 인천', imageKeyword: '', imageKeyword2: null },
      ],
      { supplierKey: 'hanatour', productDestination: '오사카', productTitle: '오사카 3일', travelScope: 'package' },
    )
    const byDay = new Map(out.map((r) => [Number(r.day), r]))
    const maxD = Math.max(...out.map((r) => Number(r.day)))
    const used = new Map<string, number>()
    for (const row of out) {
      for (const slot of [row.imageKeyword, row.imageKeyword2]) {
        const nk = normScheduleImageKeywordKey(String(slot ?? '').trim())
        if (!nk) continue
        if (used.has(nk)) {
          const prev = used.get(nk)!
          const day = Number(row.day)
          const looksBare =
            String(slot).split(/\s+/).length <= 2 &&
            !/castle|temple|park|bridge|palace|museum/i.test(String(slot))
          const allowEdge =
            looksBare && ((prev <= 1 && day >= maxD) || (day <= 1 && prev >= maxD))
          expect(allowEdge).toBe(true)
        } else {
          used.set(nk, Number(row.day))
        }
      }
    }
    expect(String(byDay.get(1)?.imageKeyword ?? '')).toMatch(/Osaka/i)
    expect(String(byDay.get(2)?.imageKeyword ?? '').length).toBeGreaterThan(0)
  })

  it('fills middle-day kw2 from same-day second landmark (Oslo + Vigeland)', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      {
        day: 6,
        routeText: '오슬로 - 비겔란 조각 공원 - 아케르후스 성',
        imageKeyword: 'Oslo Norway Harbor Fjord View',
        imageKeyword2: null,
      },
    ])
    expect(out[0]!.imageKeyword).toMatch(/Oslo/i)
    expect(String(out[0]!.imageKeyword2 ?? '')).toMatch(/Vigeland/i)
  })

  it('fills Oslo fjord cruise kw2 with Akershus when prior Oslo landmarks are used', () => {
    const route = '오슬로 - 유람선 GO NORDIC CRUISELINE'
    const rows = Array.from({ length: 12 }, (_, i) => {
      const day = i + 1
      if (day === 6) {
        return {
          day,
          routeText: '오슬로 - 비겔란',
          imageKeyword: 'Vigeland Sculpture Park Oslo',
          imageKeyword2: 'Oslo Norway Harbor Fjord',
        }
      }
      if (day === 9) {
        return {
          day,
          routeText: route,
          imageKeyword: 'Oslo fjord sightseeing cruise Norway',
          imageKeyword2: null,
        }
      }
      return {
        day,
        routeText: `day${day}`,
        imageKeyword: `Landmark Day ${day}`,
        imageKeyword2: `Second Day ${day}`,
      }
    })
    const out = enforceRegisterScheduleTripUniqueImageKeywords(rows)
    const d9 = out.find((r) => r.day === 9)!
    expect(d9.imageKeyword).toMatch(/fjord|cruise/i)
    expect(String(d9.imageKeyword2 ?? '')).toMatch(/Akershus/i)
  })

  it('fills multi-city departure movement day kw/kw2 from departure POI rules', () => {
    const rows = Array.from({ length: 12 }, (_, i) => {
      const day = i + 1
      if (day === 10) {
        return {
          day,
          routeText: '코펜하겐',
          imageKeyword: 'Copenhagen Little Mermaid statue',
          imageKeyword2: 'Copenhagen Nyhavn',
        }
      }
      if (day === 11) {
        return {
          day,
          routeText: '코펜하겐 출발 (LO464) / 바르샤바 출발 (LO099) / 인천 출발',
          imageKeyword: '',
          imageKeyword2: null,
        }
      }
      return {
        day,
        routeText: day === 12 ? '' : `day${day}`,
        imageKeyword: day === 12 ? '' : `Landmark Day ${day}`,
        imageKeyword2: day === 12 ? null : `Second Day ${day}`,
      }
    })
    const out = enforceRegisterScheduleTripUniqueImageKeywords(rows)
    const d11 = out.find((r) => r.day === 11)!
    expect(d11.imageKeyword).toMatch(/Amalienborg/i)
    expect(String(d11.imageKeyword2 ?? '')).toMatch(/Royal Castle/i)
  })

  it('modetour Ba Na Hills fixture — middle day4 kw2 after duplicate primary swap', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(MODETOUR_BA_NA_HILLS_REGRESSION_ROWS, {
      supplierKey: 'modetour',
      productDestination: '다낭',
      productTitle: 'contract-fixture',
    })
    const d2 = out.find((r) => r.day === 2)!
    const d4 = out.find((r) => r.day === 4)!
    expect(String(d2.imageKeyword ?? '')).toMatch(/My Khe/i)
    expect(String(d4.imageKeyword ?? '')).toMatch(/Hoi An/i)
  })

  it('allows route-order kw2 landmark even when trip-used (Pisa before Venice)', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      { day: 2, routeText: '피사 - 베니스', imageKeyword: 'Venice Grand', imageKeyword2: '' },
      {
        day: 4,
        routeText: '피사 - 피사의 사탑',
        imageKeyword: 'Leaning Tower of Pisa Cathedral Square',
        imageKeyword2: null,
      },
    ])
    const d2 = out.find((r) => r.day === 2)!
    expect(String(d2.imageKeyword2 ?? '')).toMatch(/Pisa|Leaning/i)
  })

  it('duplicate hub primary — same-day route landmark로 교체', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      { day: 1, routeText: '인천 - 장가계', imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        routeText: '장가계 - 천문산',
        imageKeyword: 'Zhangjiajie National Forest Park',
        imageKeyword2: 'Tianmen Mountain Zhangjiajie Cable Car',
      },
      {
        day: 3,
        routeText: '장가계 - 십리화랑 - 보봉호',
        imageKeyword: 'Zhangjiajie National Forest Park',
        imageKeyword2: null,
      },
      { day: 4, routeText: '', imageKeyword: 'Avatar Mountain Zhangjiajie Pillar Peaks', imageKeyword2: null },
    ])
    const d3 = out.find((r) => r.day === 3)!
    expect(String(d3.imageKeyword ?? '')).toMatch(/Ten Mile Gallery|Baofeng/i)
    expect(String(d3.imageKeyword2 ?? '').length).toBeGreaterThanOrEqual(4)
  })

  it('산토리니 클러스터 — Oia kw2 빈 슬롯 보조', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      {
        day: 4,
        routeText: '산토리니 - 피라 - 이메로비글리',
        imageKeyword: 'Santorini caldera blue domes',
        imageKeyword2: 'Fira Santorini caldera',
      },
      {
        day: 5,
        routeText: '산토리니 - Oia',
        imageKeyword: 'Oia Santorini blue domes',
        imageKeyword2: '',
      },
      { day: 6, routeText: '', imageKeyword: '', imageKeyword2: null },
    ])
    const d5 = out.find((r) => r.day === 5)!
    expect(String(d5.imageKeyword2 ?? '').length).toBeGreaterThanOrEqual(4)
  })

  it('사파리 클러스터 — 응고롱고로·세렝게티 중복 primary 보조', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      {
        day: 3,
        routeText: '아루샤 - 응고롱고로',
        imageKeyword: 'Ngorongoro Crater Tanzania Wildlife',
        imageKeyword2: 'Serengeti Savanna Wildlife',
      },
      {
        day: 4,
        routeText: '응고롱고로 - 세렝게티',
        imageKeyword: 'Lake Manyara Tanzania wildlife',
        imageKeyword2: 'Ngorongoro Crater Tanzania Wildlife',
      },
      {
        day: 5,
        routeText: '응고롱고로 - 자연보호구역 - 세렝게티',
        imageKeyword: '',
        imageKeyword2: '',
      },
    ])
    const d5 = out.find((r) => r.day === 5)!
    expect(String(d5.imageKeyword ?? '').length).toBeGreaterThanOrEqual(4)
  })

  it('마나도 — Christ 대신 Blessing Jesus', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          routeText: '인천 - 마나도',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          routeText: '토모혼 - 부나켄 - 부나켄 국립해양공원',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          routeText: '베스트웨스터민스터 호텔 본관',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          routeText: '마나도 시내 - 축복하는 예수상 전망대',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          routeText: '마나도 공항',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      { supplierKey: 'kyowontour', productDestination: '인도네시아' },
    )
    const d3 = out.find((r) => r.day === 3)!
    const d4 = out.find((r) => r.day === 4)!
    expect(String(d3.imageKeyword ?? '').length).toBeGreaterThanOrEqual(4)
    expect(String(d4.imageKeyword ?? '')).not.toMatch(/Christ the Redeemer/i)
    expect(String(d4.imageKeyword ?? '').length).toBeGreaterThanOrEqual(4)
  })

  it('마나도 — 숙박-only 중간일 kw2 prior landmark 보조', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      {
        day: 2,
        routeText: '토모혼 - 부나켄 - 부나켄 해양국립공원',
        imageKeyword: 'Tomohon Colorful Market Sulawesi Indonesia',
        imageKeyword2: 'Blessing Jesus Statue Manado North Sulawesi',
      },
      {
        day: 3,
        routeText: '부나켄 일일섬 - 부나켄 해양국립공원 - 실라덴섬',
        imageKeyword: 'Bunaken National Marine Park',
        imageKeyword2: 'Siladen Island Bunaken diving Indonesia',
      },
      {
        day: 4,
        routeText: '베스트웨스터민스터 호텔 본관',
        imageKeyword: 'Bunaken National Marine Park',
        imageKeyword2: '',
      },
      { day: 5, routeText: '마나도 공항', imageKeyword: '', imageKeyword2: null },
      { day: 6, routeText: '', imageKeyword: '', imageKeyword2: null },
    ])
    const d4 = out.find((r) => r.day === 4)!
    const d5 = out.find((r) => r.day === 5)!
    // 숙박-only day: 중복 Bunaken 제거 후 prior landmark는 공항일(edge) soft-fill로 갈 수 있음
    const lodgeOrEdge = [d4.imageKeyword, d4.imageKeyword2, d5.imageKeyword, d5.imageKeyword2]
      .map((k) => String(k ?? '').trim())
      .filter((k) => k.length >= 4)
    expect(lodgeOrEdge.length).toBeGreaterThanOrEqual(1)
    expect(lodgeOrEdge.join(' | ')).toMatch(/Bunaken|Tomohon|Blessing|Siladen|Manado/i)
  })

  it('남미 — La Paz bare city primary kw2 보조', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      {
        day: 2,
        routeText: '쿠스코 - 쿠스코 대성당',
        imageKeyword: 'Cusco Peru Plaza de Armas Colonial',
        imageKeyword2: 'Cusco Peru Plaza de Armas colonial architecture',
      },
      {
        day: 3,
        routeText: '마라스 - 마추픽chu',
        imageKeyword: 'Maras Salt Ponds Sacred Valley Peru Terraces',
        imageKeyword2: 'Machu Picchu ancient ruins mountain Peru',
      },
      {
        day: 4,
        routeText: '라파즈 시내 - 라파즈 - 라파즈 시장 - 케이블카',
        imageKeyword: 'La Paz',
        imageKeyword2: '',
      },
      { day: 5, routeText: '우유니', imageKeyword: '', imageKeyword2: null },
    ])
    const d4 = out.find((r) => r.day === 4)!
    expect(String(d4.imageKeyword2 ?? '').length).toBeGreaterThanOrEqual(4)
  })

  it('푸꾸옥 5일 — 중간일 kw2 same-day landmark (손트랑→Sunset Sanato)', () => {
    const rows = [
      {
        day: 1,
        routeText: '인천 - 푸꾸옥',
        imageKeyword: 'Phu Quoc',
        imageKeyword2: null,
      },
      {
        day: 2,
        routeText: '푸꾸옥 - 손트랑 - 호텔',
        imageKeyword: 'Phu Quoc',
        imageKeyword2: '',
      },
      {
        day: 3,
        routeText: '푸꾸옥 - 썬월드 혼똠',
        imageKeyword: 'Phu Quoc Hon Thom Cable Car',
        imageKeyword2: '',
      },
      { day: 4, routeText: '푸꾸옥 - 쯔엉동 야시장', imageKeyword: 'Duong Dong Night Market Phu Quoc', imageKeyword2: null },
      { day: 5, routeText: '', imageKeyword: '', imageKeyword2: null },
    ]
    const out = fillRegisterScheduleMiddleDayImageKeywordGaps(
      enforceRegisterScheduleTripUniqueImageKeywords(rows),
    )
    const d2 = out.find((r) => r.day === 2)!
    expect(String(d2.imageKeyword2 ?? '')).toMatch(/Sunset\s*Sanato|Sao\s*Beach|Hon\s*Thom|Grand\s*World/i)
    expect(String(d2.imageKeyword2 ?? '')).not.toMatch(/Bali|Nha\s*Trang/i)
  })

  it('캄보디아+베트남 6일 — Angkor 중간일 kw/kw2 gap-fill', () => {
    const rows = [
      { day: 1, routeText: '인천 - 씨엠립', imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        routeText: '씨엠립 - 바이욘 사원 - 타프롬 사원',
        imageKeyword: '',
        imageKeyword2: '',
      },
      {
        day: 3,
        routeText: '씨엠립 - 톤레삽호수 - 왓트마이 사원',
        imageKeyword: '',
        imageKeyword2: '',
      },
      {
        day: 4,
        routeText: '하롱베이 - 석회동굴 - 티톱섬',
        imageKeyword: '',
        imageKeyword2: '',
      },
      { day: 5, routeText: '하노이', imageKeyword: 'Hanoi Old Quarter street', imageKeyword2: null },
      { day: 6, routeText: '인천', imageKeyword: '', imageKeyword2: null },
    ]
    const out = fillRegisterScheduleMiddleDayImageKeywordGaps(
      enforceRegisterScheduleTripUniqueImageKeywords(rows),
    )
    for (const day of [2, 3, 4]) {
      const row = out.find((r) => r.day === day)!
      expect(String(row.imageKeyword ?? '').length).toBeGreaterThanOrEqual(4)
      expect(String(row.imageKeyword2 ?? '').length).toBeGreaterThanOrEqual(4)
    }
  })

  it('싱가포르 일정 — tripHay SEA라도 당일 route에 없는 Phu Quoc/Nha Trang 미주입', () => {
    const rows = [
      { day: 1, routeText: '인천 - 싱가포르', imageKeyword: 'Singapore', imageKeyword2: null },
      {
        day: 2,
        routeText: '국립식물원 보타닉 가든 - 리버원더스 - 싱가포르',
        imageKeyword: 'Singapore Botanic Gardens',
        imageKeyword2: '',
      },
      {
        day: 3,
        routeText: '유니버셜스튜디오 - 싱가포르',
        imageKeyword: 'Universal Studios Singapore',
        imageKeyword2: '',
      },
      {
        day: 4,
        routeText: '머라이언 공원 - 센토사섬 - 싱가포르',
        imageKeyword: 'Merlion Park',
        imageKeyword2: '',
      },
      { day: 5, routeText: '싱가포르 - 인천', imageKeyword: '', imageKeyword2: null },
    ]
    const out = fillRegisterScheduleMiddleDayImageKeywordGaps(
      enforceRegisterScheduleTripUniqueImageKeywords(rows),
    )
    for (const row of out) {
      const blob = `${row.imageKeyword ?? ''} ${row.imageKeyword2 ?? ''}`
      expect(blob).not.toMatch(/Phu Quoc|Nha Trang|Po Nagar|Long Son/i)
    }
    const d4 = out.find((r) => r.day === 4)!
    expect(String(d4.imageKeyword2 ?? '').length).toBeGreaterThanOrEqual(4)
  })

  it('몰디브 7일 — 리조트 중간일 kw2 cluster 허용', () => {
    const rows = [
      {
        day: 1,
        routeText: '싱가포르 - 몰디브',
        imageKeyword: 'Maldives Overwater Villa Turquoise Lagoon',
        imageKeyword2: '',
      },
      {
        day: 2,
        routeText: '몰디브 - 스피드 보트 이동',
        imageKeyword: 'Maldives beach resort aerial turquoise water',
        imageKeyword2: '',
      },
      {
        day: 3,
        routeText: '몰디브 - Maldives overwater villa turquoise lagoo',
        imageKeyword: 'Maldives Overwater Villa Turquoise Lagoo',
        imageKeyword2: '',
      },
      {
        day: 4,
        routeText: '몰디브 - Maldives overwater villa turquoise lagoo',
        imageKeyword: '',
        imageKeyword2: '',
      },
      { day: 7, routeText: '인천', imageKeyword: '', imageKeyword2: null },
    ]
    const out = fillRegisterScheduleMiddleDayImageKeywordGaps(
      enforceRegisterScheduleTripUniqueImageKeywords(rows),
    )
    const d2 = out.find((r) => r.day === 2)!
    const d4 = out.find((r) => r.day === 4)!
    expect(String(d2.imageKeyword2 ?? '').length).toBeGreaterThanOrEqual(4)
    expect(String(d4.imageKeyword ?? '').length).toBeGreaterThanOrEqual(4)
    expect(String(d4.imageKeyword2 ?? '').length).toBeGreaterThanOrEqual(4)
  })

  it('라오스 5일 — 방비엥 중간일 kw2 cluster (Patuxai/Blue Lagoon)', () => {
    const rows = [
      { day: 1, routeText: '작성 및 제출 방법 - 비엔티엔', imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        routeText: '비엔티엔 근교 - 방비엥 - 신닷',
        imageKeyword: 'Vang Vieng Nam Song River Karst Mountains',
        imageKeyword2: 'Patuxai Victory Monument Vientiane',
      },
      {
        day: 3,
        routeText: '방비엥 - 그네타기 등 액티비티 체험) - 까오삐약&새우볶음밥 - BBQ SET',
        imageKeyword: 'Vang Vieng Nam Song River Karst Mountains',
        imageKeyword2: '',
      },
      {
        day: 4,
        routeText: '방비엥 - 비엔티엔 - 쇼핑센터 - 쌈밥정식 - 현지식 SET',
        imageKeyword: 'Vang Vieng Nam Song River Karst Mountains',
        imageKeyword2: 'Patuxai Victory Monument Vientiane',
      },
      { day: 5, routeText: '비엔티엔 - 파 That Luang', imageKeyword: '', imageKeyword2: null },
    ]
    const out = fillRegisterScheduleMiddleDayImageKeywordGaps(
      enforceRegisterScheduleTripUniqueImageKeywords(rows),
    )
    const d3 = out.find((r) => r.day === 3)!
    expect(String(d3.imageKeyword ?? '').length).toBeGreaterThanOrEqual(4)
    expect(String(d3.imageKeyword2 ?? '').length).toBeGreaterThanOrEqual(4)
    expect(String(d3.imageKeyword2 ?? '')).not.toMatch(/phu quoc/i)
  })

  it('라오스 5일 — applyRegisterScheduleImageKeywordsBySupplier full pipeline', () => {
    const rows = [
      { day: 1, routeText: '작성 및 제출 방법 - 비엔티엔', imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        routeText: '비엔티엔 근교 - 방비엥 - 신닷',
        imageKeyword: 'Vang Vieng Nam Song River Karst Mountains',
        imageKeyword2: 'Patuxai Victory Monument Vientiane',
      },
      {
        day: 3,
        routeText: '방비엥 - 그네타기 등 액티비티 체험) - 까오삐약&새우볶음밥 - BBQ SET',
        imageKeyword: 'Vang Vieng Nam Song River Karst Mountains',
        imageKeyword2: '',
      },
      {
        day: 4,
        routeText: '방비엥 - 비엔티엔 - 쇼핑센터 - 쌈밥정식 - 현지식 SET',
        imageKeyword: 'Vang Vieng Nam Song River Karst Mountains',
        imageKeyword2: 'Patuxai Victory Monument Vientiane',
      },
      { day: 5, routeText: '비엔티엔 - 파 That Luang', imageKeyword: '', imageKeyword2: null },
    ]
    const out = applyRegisterScheduleImageKeywordsBySupplier(rows, {
      supplierKey: 'lottetour',
      productDestination: 'laos',
      travelScope: 'overseas',
    })
    const keys = out
      .filter((r) => Number(r.day) > 0)
      .flatMap((r) => [r.imageKeyword, r.imageKeyword2].filter(Boolean))
      .map((k) => normScheduleImageKeywordKey(String(k)))
    expect(new Set(keys).size).toBe(keys.length)
    for (const row of out) {
      const kw2 = String(row.imageKeyword2 ?? '')
      if (kw2) expect(kw2).not.toMatch(/phu quoc/i)
    }
  })

  it('발리 6일 — 귀국일 imageKeyword (hanatour regression)', () => {
    const BALI_SCHEDULE = [
      { day: 1, routeText: '발리 주요 관광지 지도 - 발리지도', imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        routeText: '전일 자유시간 - 발리에서 즐기는 여유로운 하루 - 비치 클럽 크루즈 - 발리 - 빠당빠당',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        routeText: '전일 자유시간 - 발리에서 즐기는 여유로운 하루 - 비치 클럽 크루즈 - 발리 - 빠당빠당',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        routeText: '전일 자유시간 - 발리에서 즐기는 여유로운 하루 - 비치 클럽 크루즈 - 발리 - 빠당빠당',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 5,
        routeText: '남부투어 - 가루다 공원 - 울루와뚜 절벽사원 - 멜라스티 비치 음료 - 발리 - 발리 해변',
        imageKeyword: '',
        imageKeyword2: null,
      },
      { day: 6, routeText: '발리', imageKeyword: '', imageKeyword2: null },
    ]
    const out = applyRegisterScheduleImageKeywordsBySupplier(BALI_SCHEDULE, {
      supplierKey: 'hanatour',
      productDestination: '발리',
      productTitle: '발리 6일',
    })
    const day6 = out.find((r) => r.day === 6)!
    expect(String(day6.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
    // 비치 클럽 크루즈만으로 Alaska/Seattle 키워드 유입 금지
    const blob = out
      .flatMap((r) => [r.imageKeyword, r.imageKeyword2])
      .map((k) => String(k ?? ''))
      .join(' | ')
    expect(blob).not.toMatch(/Glacier Bay|Pike Place|Space Needle|Alaska|Seattle/i)
  })

  it('apply pipeline — imageKeyword2 일자 간 중복 시 route 차순위 명소', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
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
      { supplierKey: 'hanatour', productDestination: 'India', productTitle: '인도 4일' },
    )
    const keys = out
      .filter((r) => Number(r.day) > 0 && Number(r.day) < 4)
      .flatMap((r) => [r.imageKeyword, r.imageKeyword2].filter(Boolean))
      .map((k) => normScheduleImageKeywordKey(String(k)))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('Guam — 스페인광장 must not inject Prague/Budapest Europe fillers', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, routeText: '인천 - 괌', imageKeyword: '', imageKeyword2: null },
        {
          day: 2,
          routeText: '아푸간 요새 - 괌 스페인광장 - 이파오비치',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          routeText: '아푸간 요새 - 괌 스페인광장 - 이파오비치',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 4, routeText: '괌 - 인천', imageKeyword: '', imageKeyword2: null },
      ],
      { supplierKey: 'modetour', productDestination: '괌', productTitle: '괌 4일' },
    )
    const blob = out
      .flatMap((r) => [r.imageKeyword, r.imageKeyword2])
      .filter(Boolean)
      .join(' | ')
    expect(blob).not.toMatch(/Prague|Budapest|Hungarian Parliament|Charles Bridge/i)
    expect(blob).toMatch(/Guam|Apugan|Tumon|Ipao|Spain Square|Spanish/i)
  })

  it('Croatia Split day — must not kw2 Prague when day route has no Prague', () => {
    const out = fillRegisterScheduleMiddleDayImageKeywordGaps(
      [
        {
          day: 1,
          routeText: '프라하 - 체스키크롬로프',
          imageKeyword: 'Cesky Krumlov Castle Czech Republic',
          imageKeyword2: null,
        },
        {
          day: 2,
          routeText: '스플리트 - 마리안 해변 - 트로기르',
          imageKeyword: 'Diocletian Palace Split Croatia',
          imageKeyword2: '',
        },
        {
          day: 3,
          routeText: '쉔부른궁전 - 성 슈테판 대성당',
          imageKeyword: 'Schonbrunn Palace',
          imageKeyword2: null,
        },
      ],
      { productDestination: '동유럽', productTitle: '동유럽 발칸' },
    )
    const d2 = out.find((r) => r.day === 2)!
    expect(String(d2.imageKeyword2 ?? '')).not.toMatch(/Prague|Charles Bridge/i)
  })

  it('푸꾸옥 — Phu Quoc bare city must not repeat across middle days', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, routeText: '인천 - 푸꾸옥', imageKeyword: '', imageKeyword2: null },
        {
          day: 2,
          routeText: '푸꾸옥 - 썬월드 혼똠 - 그랜드월드',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          routeText: '푸꾸옥 - 딘커우 사원 - 그랜드월드',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          routeText: '푸꾸옥 - 후추농장 - 쯔엉동 야시장',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 5, routeText: '', imageKeyword: '', imageKeyword2: null },
      ],
      { supplierKey: 'ybtour', productDestination: '푸꾸옥', productTitle: '푸꾸옥 5일' },
    )
    const keys = out
      .flatMap((r) => [r.imageKeyword, r.imageKeyword2])
      .filter(Boolean)
      .map((k) => normScheduleImageKeywordKey(String(k)))
    expect(new Set(keys).size).toBe(keys.length)
    expect(String(out.find((r) => r.day === 5)?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
  })

  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: Phu Quoc day ownership — manifest
  it('푸꾸옥 — day-owned landmarks; no Sao Beach/Hon Thom bleed; no Nha Trang/Bali', () => {
    const dirty = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          routeText:
            '입국신고서 - 비용 : 1만원/1인(아동동일) - 호국사 - 먹거리 볼거리 가득 소나시 야시장',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          routeText: '푸꾸옥 - 썬월드 혼똠 - 그랜드월드 - 베트남 맛집 두번째 미식',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          routeText: '바다가 보이는 딘커우 사원 - 그랜드월드 - 세번째 미식',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          routeText: '후추농장 - 푸꾸옥 대표 야시장인 쯔엉동 야시장 - 미식',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 5, routeText: '', imageKeyword: '', imageKeyword2: null },
      ],
      { supplierKey: 'ybtour', productDestination: '푸꾸옥', productTitle: '푸꾸옥 5일' },
    )
    const d1 = dirty.find((r) => r.day === 1)!
    const d2 = dirty.find((r) => r.day === 2)!
    const d3 = dirty.find((r) => r.day === 3)!
    const d4 = dirty.find((r) => r.day === 4)!
    const d5 = dirty.find((r) => r.day === 5)!
    expect(String(d1.routeText ?? '')).toMatch(/호국사|소나시/)
    expect(String(d1.routeText ?? '')).not.toMatch(/비용|미식|먹거리|입국신고서/)
    expect(String(d2.routeText ?? '')).toMatch(/혼똠|그랜드/)
    expect(String(d2.routeText ?? '')).not.toMatch(/미식/)
    expect(`${d2.imageKeyword}|${d2.imageKeyword2}`).toMatch(/Hon\s*Thom|Grand\s*World/i)
    expect(`${d2.imageKeyword}|${d2.imageKeyword2}`).not.toMatch(/Sao\s*Beach/i)
    expect(`${d3.imageKeyword}|${d3.imageKeyword2}`).toMatch(/Dinh\s*Cau|Grand\s*World/i)
    expect(`${d3.imageKeyword}|${d3.imageKeyword2}`).not.toMatch(/Hon\s*Thom/i)
    expect(`${d4.imageKeyword}|${d4.imageKeyword2}`).toMatch(/Duong\s*Dong|Pepper/i)
    expect(`${d4.imageKeyword}|${d4.imageKeyword2}`).not.toMatch(/Po\s*Nagar|Long\s*Son|Nha\s*Trang/i)
    const blob = dirty
      .flatMap((r) => [r.imageKeyword, r.imageKeyword2])
      .filter(Boolean)
      .join(' | ')
    expect(blob).not.toMatch(/Bali|Tegalalang|Po\s*Nagar|Nha\s*Trang/i)
    expect(String(d5.imageKeyword ?? '')).not.toMatch(/Sonasea|Bali|Tegalalang/i)
  })

  it('middle empty soft-dup visit city when landmark already used (Palace / Saipan)', () => {
    const nwp = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          routeText: '로스엔젤레스 공항',
          imageKeyword: '',
          imageKeyword2: null as string | null,
        },
        {
          day: 2,
          routeText: '샌프란시스코 시내 - 어부의 선착장 - 팔레스 오브 파인 아트',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 9,
          routeText: '로스앤젤레스 - 팔레스 오브 파인 아트',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 10,
          routeText: '로스엔젤레스 공항 출발',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'ybtour',
        productDestination: '미서부',
        productTitle: '미서부 9일',
        travelScope: 'package',
      },
    )
    expect(String(nwp.find((r) => r.day === 2)?.imageKeyword2 ?? nwp.find((r) => r.day === 2)?.imageKeyword ?? '')).toMatch(
      /Palace of Fine Arts/i,
    )
    const d9 = String(nwp.find((r) => r.day === 9)?.imageKeyword ?? '').trim()
    expect(d9.length).toBeGreaterThan(0)
    expect(d9).toMatch(/Los Angeles|Hollywood|Palace of Fine Arts/i)

    const dupCleared = enforceRegisterScheduleTripUniqueImageKeywords([
      {
        day: 1,
        routeText: '로스엔젤레스 공항',
        imageKeyword: 'Los Angeles',
        imageKeyword2: null,
      },
      {
        day: 2,
        routeText: '샌프란시스코 - 팔레스 오브 파인 아트',
        imageKeyword: "Fisherman's Wharf",
        imageKeyword2: 'Palace of Fine Arts',
      },
      {
        day: 9,
        routeText: '로스앤젤레스 - 팔레스 오브 파인 아트',
        imageKeyword: 'Palace of Fine Arts',
        imageKeyword2: null,
      },
      {
        day: 10,
        routeText: '로스엔젤레스 공항 출발',
        imageKeyword: 'Los Angeles',
        imageKeyword2: null,
      },
    ])
    expect(String(dupCleared.find((r) => r.day === 9)?.imageKeyword ?? '')).toMatch(/Los Angeles|Hollywood/i)
    expect(mapDestination('로스앤젤레스')).toBe('Los Angeles')

    const sai = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          routeText: '천혜의 자연 새섬 - PACIFIC ISLANDS CLUB SAIPAN (PIC SAIPAN)',
          imageKeyword: '',
          imageKeyword2: null as string | null,
        },
        {
          day: 2,
          routeText: 'Pacific Islands Club SAIPAN - 워터파크',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          routeText: '사이판 북섬 - 마나가하섬 - 새 섬 - 한국인 위령탑 - 만세절벽',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          routeText: '조텐 쇼핑센터 - 사이판 ABC 스토어 - 서프 클럽',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          routeText: '일 2회 호텔',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 6,
          routeText: '사이판 공항 출발',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '사이판',
        productTitle: '사이판 PIC',
        travelScope: 'package',
      },
    )
    // REGRESSION-FREEZE[schedule-poi-regex-ssot]: Saipan PIC·북섬 POI — bare Saipan 반복 금지 — manifest
    expect(String(sai.find((r) => r.day === 1)?.imageKeyword ?? '')).toMatch(/Bird Island/i)
    expect(String(sai.find((r) => r.day === 2)?.imageKeyword ?? '')).toMatch(/Pacific Islands Club/i)
    expect(`${sai.find((r) => r.day === 3)?.imageKeyword}|${sai.find((r) => r.day === 3)?.imageKeyword2}`).toMatch(
      /Managaha|Suicide Cliff|Korean Peace Memorial/i,
    )
    expect(String(sai.find((r) => r.day === 3)?.imageKeyword ?? '')).not.toBe('Saipan')
    expect(String(sai.find((r) => r.day === 4)?.imageKeyword ?? '')).toMatch(/Joeten|Garapan|ABC/i)
    expect(String(sai.find((r) => r.day === 4)?.imageKeyword ?? '')).not.toBe('Saipan')
    const midBare = [3, 4, 5]
      .map((d) => String(sai.find((r) => r.day === d)?.imageKeyword ?? '').trim())
      .filter((k) => /^saipan$/i.test(k))
    expect(midBare.length).toBeLessThanOrEqual(1)
    expect(String(sai.find((r) => r.day === 6)?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
  })

  it('final return refill does not duplicate a middle-day landmark', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, routeText: '두바이', imageKeyword: '', imageKeyword2: null as string | null },
        {
          day: 2,
          routeText: '아부다비 왕궁 - 그랜드 모스크 - 두바이몰 분수쇼',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 3, routeText: '두바이 - 버즈칼리파 전망대', imageKeyword: '', imageKeyword2: null },
        { day: 4, routeText: '두바이 - 팜주메이라 전망대', imageKeyword: '', imageKeyword2: null },
        {
          day: 5,
          routeText: '알 파히디 - 금시장 - 향신료 시장 - 두바이 프레임',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 6, routeText: '', imageKeyword: '', imageKeyword2: null },
      ],
      {
        supplierKey: 'modetour',
        productDestination: '두바이',
        productTitle: '두바이 아부다비 6일',
        travelScope: 'package',
      },
    )
    const d5 = out.find((r) => r.day === 5)!
    const d6 = out.find((r) => r.day === 6)!
    const middle = [d5.imageKeyword, d5.imageKeyword2]
      .map((k) => normScheduleImageKeywordKey(String(k ?? '')))
      .filter(Boolean)
    expect(middle).not.toContain(normScheduleImageKeywordKey(String(d6.imageKeyword ?? '')))
  })
})
