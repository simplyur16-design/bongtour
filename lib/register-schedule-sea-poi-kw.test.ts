/**
 * REGRESSION-FREEZE[register-schedule-sea-poi-kw]: 보홀·세부 한글 route → imageKeyword — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'

describe('register-schedule-sea-poi-kw', () => {
  it('normalizes CMS underscore compounds in route segments', () => {
    expect(splitRouteTextPlaceSegments('보홀_초콜릿힐 - 노스젠 밤부브릿지 선셋')).toEqual([
      '보홀 초콜릿힐',
      '노스젠 밤부브릿지 선셋',
    ])
  })

  it('maps Bohol 2030-style Korean routeText to English landmarks', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '1일차',
          description: '',
          routeText: null,
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '노스젠',
          description: '',
          routeText: '노스젠 밤부브릿지 선셋 - 맹그로브_노스젠 밤부브릿지',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: 'ICM',
          description: '',
          routeText: '보홀 아일랜드 시티몰 - 보홀_초콜릿힐',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '보홀',
        productTitle: '[2030전용] 보홀 5일 #헤난알로나비치',
      },
    )
    expect(String(out.find((r) => r.day === 2)?.imageKeyword ?? '')).toMatch(/Bamboo Bridge/i)
    expect(String(out.find((r) => r.day === 4)?.imageKeyword ?? '')).toMatch(/Chocolate Hills/i)
  })

  it('AAP218 Bangkok day4 — Bang Luang not NYC Central Park (Dusit)', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: AAP218 방루앙·두짓≠NYC Central Park — manifest
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 4,
          title: '방루앙 운하마을 · 왓빡남',
          description: '',
          routeText: '방루앙 운하마을 - 왓빡남 - 아티스트 하우스 - 두짓 센트럴 파크',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '방콕',
        productTitle:
          '방콕 5일 #타이쿠킹클래스 #올드타운투어 #빈티지짜뚜짝시장 #방루앙운하마을 #두짓센트럴파크',
        supplierKey: 'hanatour',
      },
    )
    const kw = String(out[0]?.imageKeyword ?? '')
    expect(kw).not.toMatch(/Central Park New York|^Central Park$/i)
    expect(kw).toMatch(/Bang Luang|Wat Paknam|Artist House|Dusit Central Park/i)
  })

  it('AVP227 Nha Trang day2 — pirate hopping not Cebu', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: AVP227 나트랑 해적호핑≠Cebu Pirate — manifest
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '나트랑 해적 호핑 · 나트랑 레일웨이 카페',
          description: '',
          routeText: '나트랑 해적 호핑 - 나트랑 레일웨이 카페 - 오늘의 감성카페 - 스카이라이트',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '나트랑',
        productTitle: '나트랑 5일 #해적호핑 #레일웨이카페 #판랑사막 #코코배',
        supplierKey: 'hanatour',
      },
    )
    const kw1 = String(out[0]?.imageKeyword ?? '')
    const kw2 = String(out[0]?.imageKeyword2 ?? '')
    expect(kw1).not.toMatch(/Cebu/i)
    expect(kw2).not.toMatch(/Cebu/i)
    expect(kw1).toMatch(/Nha Trang.*Pirate|Pirate.*Nha Trang/i)
  })

  it('AYP261 KK free day — 코타키나발루≠Kinabalu Park', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: AYP261 코타키나발루≠Kinabalu Park — manifest
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 4,
          title: '자유 일정 · 코타키나발루',
          description: '',
          routeText: '코타키나발루 자유 일정',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '코타키나발루',
        productTitle: '코타키나발루 5일 #시티모스크 #핑크모스크 #바나나보트 #자유일정',
        supplierKey: 'hanatour',
      },
    )
    const kw1 = String(out[0]?.imageKeyword ?? '')
    const kw2 = String(out[0]?.imageKeyword2 ?? '')
    expect(kw1).not.toMatch(/Kinabalu Park/i)
    expect(kw2).not.toMatch(/Kinabalu Park/i)
    expect(`${kw1} ${kw2}`).toMatch(/Kota Kinabalu/i)
  })

  it('JKP135 Fukuoka day2 — Shikanoshima not Tottori Sand Dunes', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: JKP135 시카노시마≠Tottori — manifest
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '규슈 입국',
          description: '',
          routeText: '규슈 입국',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '시카노시마 해안선 사이클링',
          description: '',
          routeText:
            '시카노시마 해안선 사이클링 코스 - 시카시마 사이클링 코스 - 후쿠오카의 청량한 바다를 가르는 사이클링',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '규슈 출발 및 인천 귀국',
          description: '',
          routeText: '규슈 출발 및 인천 귀국',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '규슈',
        productTitle: '규슈·후쿠오카 3일 #해안가 사이클링 #시카노시마',
        supplierKey: 'hanatour',
      },
    )
    const d2 = out.find((r) => r.day === 2)
    const kw1 = String(d2?.imageKeyword ?? '')
    const kw2 = String(d2?.imageKeyword2 ?? '')
    expect(kw1).not.toMatch(/Tottori/i)
    expect(kw2).not.toMatch(/Tottori/i)
    expect(`${kw1} ${kw2}`).toMatch(/Shikanoshima/i)
  })

  it('ALP201 Laos — Vang Vieng days not Patuxai/That Luang; Wat Si Muang on day1', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: ALP201 왓씨므앙·방비엥 액티비티 — manifest
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '왓 씨 므앙',
          description: '',
          routeText: '라오스 담당자 소개 - 왓 씨 므앙 - Corebeer Brewery',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '방비엥 · 카약킹',
          description: '',
          routeText: '방비엥 - 카약킹 - 방비엥_추천도시_스케줄러 - 방비엥7',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '짚라인 · 열기구',
          description: '',
          routeText: 'V COFFEE & TEA - 짚라인 - 라오스 열기구 - 방비엥 열기구',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '파 탓 루앙',
          description: '',
          routeText: '라오아트뮤지엄 - 조각아트 박물관 - 독립기념탑 - 파 탓 루앙',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '귀국',
          description: '',
          routeText: '라오스 비엔티안 출발 및 인천 귀국',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '라오스',
        productTitle: '라오스 방비엥 5일 #카약 #열기구 #파탓루앙',
        supplierKey: 'hanatour',
      },
    )
    const by = (d: number) => out.find((r) => r.day === d)
    expect(String(by(1)?.imageKeyword ?? '')).toMatch(/Wat Si Muang|Corebeer/i)
    expect(String(by(1)?.imageKeyword ?? '')).not.toMatch(/Vang Vieng/i)
    expect(`${by(2)?.imageKeyword ?? ''} ${by(2)?.imageKeyword2 ?? ''}`).not.toMatch(
      /Patuxai|Pha That Luang/i,
    )
    expect(`${by(2)?.imageKeyword ?? ''} ${by(2)?.imageKeyword2 ?? ''}`).toMatch(
      /Vang Vieng|kayak|Nam Song|Blue Lagoon/i,
    )
    expect(`${by(3)?.imageKeyword ?? ''} ${by(3)?.imageKeyword2 ?? ''}`).not.toMatch(
      /Patuxai|Pha That Luang/i,
    )
    expect(`${by(3)?.imageKeyword ?? ''} ${by(3)?.imageKeyword2 ?? ''}`).toMatch(
      /zipline|balloon|Vang Vieng|Blue Lagoon|Nam Song/i,
    )
    expect(`${by(4)?.imageKeyword ?? ''} ${by(4)?.imageKeyword2 ?? ''}`).toMatch(
      /Patuxai|That Luang|sculpture|Museum/i,
    )
  })

  it('ASP214 Singapore — Sentosa day not Gardens; Merlion typo; Peranakan/Siloso', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: ASP214 멀라이언·페라나칸·실로소 — manifest
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '마리나베이',
          description: '',
          routeText:
            '싱가포르_마리나베이_스카이파크_전망대 - 페라나칸 테라스 하우스 - Peranakan Cuisine_HR_031 - 정보 및 팁!',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '가든스',
          description: '',
          routeText: '포레스트 - 가든스바이더베이_플라워돔 - 멀라이언 파크',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '차임스',
          description: '',
          routeText: '차임스 - 뎀시 힐 - 티옹바루 - 클럽 스트리트 & 안 시앙 로드',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '센토사',
          description: '',
          routeText: '페라나칸 플레이스 - 센토사 실로소 비치 - 실로소! - 어드벤처',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '귀국',
          description: '',
          routeText: '싱가포르 출발 및 인천 귀국',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '싱가포르',
        productTitle: '싱가포르 5일 #마리나베이 #가든스바이더베이 #센토사',
        supplierKey: 'hanatour',
      },
    )
    const by = (d: number) => out.find((r) => r.day === d)
    expect(`${by(1)?.imageKeyword ?? ''} ${by(1)?.imageKeyword2 ?? ''}`).toMatch(/Marina Bay|Peranakan/i)
    expect(`${by(2)?.imageKeyword ?? ''} ${by(2)?.imageKeyword2 ?? ''}`).toMatch(/Gardens by the Bay/i)
    expect(`${by(2)?.imageKeyword ?? ''} ${by(2)?.imageKeyword2 ?? ''}`).toMatch(/Merlion/i)
    expect(String(by(3)?.imageKeyword ?? '')).toMatch(/CHIJMES/i)
    expect(`${by(4)?.imageKeyword ?? ''} ${by(4)?.imageKeyword2 ?? ''}`).not.toMatch(/Gardens by the Bay/i)
    expect(`${by(4)?.imageKeyword ?? ''} ${by(4)?.imageKeyword2 ?? ''}`).toMatch(
      /Sentosa|Siloso|Peranakan/i,
    )
  })

  it('AVP205 Sapa/Hanoi — Day1 Long Bien not dest Sapa; Day3 Fansipan soft-dup', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: AVP205 롱비엔·하노이 구시가지 — manifest
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: AVP205 Fansipan route revisit soft-dup — manifest
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          title: '',
          description: '',
          routeText: '클릭 - 반미 - 반미 25 - 롱비엔',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '',
          description: '',
          routeText: '사파 슬리핑 버스 - 판시판 테라스 카페 - 카페 - 깟깟 마을',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '',
          description: '',
          routeText: '베트남 판시판 - 판시판 - 사파 정상 - 사파 여행 필수 관광지',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '',
          description: '',
          routeText: '사파 슬리핑 버스 - 구시가지 - 하노이 스트리트카 - 호안끼엠 호수',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '',
          description: '',
          routeText: '하노이 출발 및 인천 귀국',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '사파',
        productTitle: '하노이/사파 5일 #판시판 #깟깟마을',
        travelScope: 'package',
      },
    )
    const by = (d: number) => out.find((r) => r.day === d)
    expect(String(by(1)?.imageKeyword ?? '')).toMatch(/Long Bien/i)
    expect(String(by(1)?.imageKeyword ?? '')).not.toMatch(/^Sapa$/i)
    expect(String(by(2)?.imageKeyword ?? '')).toMatch(/Fansipan/i)
    expect(String(by(2)?.imageKeyword2 ?? '')).toMatch(/Cat Cat/i)
    expect(String(by(3)?.imageKeyword ?? '')).toMatch(/Fansipan/i)
    expect(`${by(4)?.imageKeyword ?? ''} ${by(4)?.imageKeyword2 ?? ''}`).toMatch(/Hoan Kiem|Old Quarter/i)
    expect(String(by(5)?.imageKeyword ?? '')).toMatch(/Hanoi/i)
  })

  it('ATP223 Taipei — Dihua Street + Pier5 on Day1; free day no Pier bleed', () => {
    // REGRESSION-FREEZE[schedule-poi-regex-ssot]: ATP223 Dihua Street≠bare Dihua — manifest
    // REGRESSION-FREEZE[schedule-poi-regex-ssot]: ATP223 departure multi-tourism keeps kw2 — manifest
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          title: '디화제',
          description: '',
          routeText: '디화제 - 다다오청 PIER5',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '카발란',
          description: '',
          routeText: '카발란 위스키 증류소 - 카발란 위스키 공장 - 카발란 위스키 DIY - 장메이 아마 농장',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '자유 일정',
          description: '',
          routeText: '타이베이 자유 일정',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '까르푸',
          description: '',
          routeText: '까르푸 꾸이린점 - 까르푸 하나투어 고객 계산대 - 까르푸 쇼핑 리스트',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '타이베이',
        productTitle: '타이베이 4일 #디화제 #다다오청 #카발란 #장메이',
        travelScope: 'package',
      },
    )
    const by = (d: number) => out.find((r) => r.day === d)
    expect(String(by(1)?.imageKeyword ?? '')).toMatch(/Dihua Street/i)
    expect(String(by(1)?.imageKeyword ?? '')).not.toMatch(/^Dihua$/i)
    expect(String(by(1)?.imageKeyword2 ?? '')).toMatch(/Pier\s*5|Dadaocheng/i)
    expect(String(by(2)?.imageKeyword ?? '')).toMatch(/Kavalan/i)
    expect(String(by(2)?.imageKeyword2 ?? '')).toMatch(/Zhangmei/i)
    expect(String(by(3)?.imageKeyword ?? '')).toMatch(/Taipei/i)
    expect(String(by(3)?.imageKeyword2 ?? '')).not.toMatch(/Pier|Dihua|Dadaocheng/i)
    expect(String(by(4)?.imageKeyword ?? '')).toMatch(/Taipei/i)
    expect(String(by(4)?.imageKeyword2 ?? '')).not.toMatch(/Pier|Dihua/i)
  })

  it('AVP257 Phu Quoc — Sonashi+Crazy Hopping; free day no Beach Club', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: AVP257 Phu Quoc Crazy Hopping·free-day≠Beach Club — manifest
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: Sonashi≠Beach Club same-day twin — manifest
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          title: '',
          description: '',
          routeText: '푸꾸옥 입국',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '',
          description: '',
          routeText: '크레이지 호핑 - 소나시 비치바 푸꾸옥 - 베스트웨스턴 비치클럽 - 핫한 신상 비치클럽',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '',
          description: '',
          routeText: '푸꾸옥 자유 일정',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '',
          description: '',
          routeText: '킹콩마트 - 기념품 사기 좋은 푸꾸옥 대표 마트 - 더 피크 푸꾸옥 - 더피크 레스토랑&카페 정원',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '',
          description: '',
          routeText: '푸꾸옥 출발 및 인천 귀국',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '푸꾸옥',
        productTitle: '푸꾸옥 5일 #크레이지호핑 #소나시 #더피크 #자유일정',
        travelScope: 'package',
      },
    )
    const by = (d: number) => out.find((r) => r.day === d)!
    expect(String(by(1).imageKeyword ?? '')).toMatch(/Phu Quoc/i)
    const d2 = `${by(2).imageKeyword ?? ''} ${by(2).imageKeyword2 ?? ''}`
    expect(d2).toMatch(/Sonashi/i)
    expect(d2).toMatch(/Crazy|Hopping/i)
    expect(d2).not.toMatch(/Beach Club|Tropical Beach/i)
    expect(String(by(3).imageKeyword ?? '')).toMatch(/Phu Quoc/i)
    expect(String(by(3).imageKeyword2 ?? '')).not.toMatch(/Beach Club|Tropical|Sonashi/i)
    expect(String(by(4).imageKeyword ?? '')).toMatch(/Peak/i)
    expect(String(by(5).imageKeyword ?? '')).toMatch(/Phu Quoc/i)
  })
})
