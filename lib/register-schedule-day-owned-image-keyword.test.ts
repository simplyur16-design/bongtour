/**
 * REGRESSION-FREEZE[register-schedule-day-owned-image-keyword]: 당일 routeText만 — 타 일차 landmark 금지
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

const US_EAST_SCHEDULE = [
  { day: 1, routeText: '에어프레미아 항공 - 에어프리미아', imageKeyword: '', imageKeyword2: null },
  {
    day: 2,
    routeText: '프린스톤 대학교 - 프린스턴 대학교 아이비리그 - 필라델피아 관광 - 필라델피아 독립기념관 - 인디펜던스 홀 - 펜실베니아 대학교',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    routeText: '워싱턴 D.C. - 링컨 기념관 - 스미소니언 박물관 - 자연사 박물관 - # 미국 정치의 중심 - 워싱턴 관광 - 국회의사당',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 4, routeText: '캐나다 나이아가라폭포 - 관람 지역 - 테이블 락 - 꽃시계 - 월풀 - 나이아가라 월풀', imageKeyword: '', imageKeyword2: null },
  { day: 5, routeText: '나이아가라 크루즈 - 나이아가라 시티 크루즈 - 나이아가라 아이스와인 공장 - REIF 와이너리', imageKeyword: '', imageKeyword2: null },
  { day: 6, routeText: '하버드 대학교 - 엠아이티 - MIT - MIT 엠아이티 - 보스턴 - 보스턴 배너용1 - 보스톤', imageKeyword: '', imageKeyword2: null },
  { day: 7, routeText: '예일 대학교 - 우드버리 아울렛 - 우드버리 아웃렛', imageKeyword: '', imageKeyword2: null },
  {
    day: 8,
    routeText: "센트럴 파크 - 뉴욕 관광청 - 록펠러 센터 전망대 - 9.11 메모리얼 - 브룩필드 플레이스 - 로어 맨하튼의 '월스트리트' 워킹 투어 - 황소 동상",
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 9, routeText: '뉴욕 - 인천', imageKeyword: '', imageKeyword2: null },
  { day: 10, routeText: '인천', imageKeyword: '', imageKeyword2: null },
]

describe('US east register schedule — day-owned imageKeyword', () => {
  it('hanatour HEP141-like — no cross-day landmark bleed', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(US_EAST_SCHEDULE, {
      supplierKey: 'hanatour',
      productDestination: '미국',
      productTitle: '미동부 10일',
    })
    const byDay = new Map(out.map((r) => [r.day, r]))

    expect(String(byDay.get(1)?.imageKeyword ?? '').trim()).toBe('')
    expect(String(byDay.get(3)?.imageKeyword ?? '')).toMatch(/Lincoln Memorial/i)
    expect(String(byDay.get(4)?.imageKeyword ?? '')).toMatch(/Niagara/i)
    expect(String(byDay.get(6)?.imageKeyword ?? '')).toMatch(/Harvard|MIT|Boston/i)
    expect(String(byDay.get(8)?.imageKeyword ?? '')).toMatch(/Central Park|Rockefeller|9\/11|Charging Bull/i)
    expect(String(byDay.get(10)?.imageKeyword ?? '')).toMatch(/Central Park|Rockefeller|9\/11|Charging Bull/i)

    const day3kw = normScheduleImageKeywordKey(String(byDay.get(3)?.imageKeyword ?? ''))
    const day4kw = normScheduleImageKeywordKey(String(byDay.get(4)?.imageKeyword ?? ''))
    const day6kw = normScheduleImageKeywordKey(String(byDay.get(6)?.imageKeyword ?? ''))
    expect(day3kw).not.toBe(day4kw)
    expect(String(byDay.get(5)?.imageKeyword ?? '')).toMatch(/Niagara/i)
    expect(String(byDay.get(5)?.imageKeyword ?? '')).not.toMatch(/Washington|Boston|New York/i)
    expect(String(byDay.get(6)?.imageKeyword ?? '')).not.toMatch(/Niagara|Washington/i)
    expect(day6kw).not.toBe(day3kw)
  })

  it('NZ/AU hanatour — schedule_section 반딧불 오염 없이 당일 routeText만', () => {
    const scheduleSectionByDay = new Map<number, string>([
      [3, '선택관광: MD추천 선셋 반딧불이 투어 (코타키나발루)'],
    ])
    const rows = [
      { day: 1, routeText: '인천', imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        routeText: '쿠메우 지역 와이너리 방문 & 시음 - 폴리네시안 스파',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        routeText:
          '로토루아 호수 - 아그로돔 양털깎이쇼&팜투어 - 🚠스카이라인 곤돌라 + 뷔페중식 - 와카레와레와 마오리민속마을',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        routeText: '오클랜드 - 미션베이 - 마이클 조셉 세비지 기념공원 - 에덴동산',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    const out = applyRegisterScheduleImageKeywordsBySupplier(rows, {
      supplierKey: 'hanatour',
      productDestination: '뉴질랜드',
      productTitle: '뉴질랜드 호주',
      scheduleSectionByDay,
    })
    const day3 = out.find((r) => r.day === 3)
    expect(String(day3?.imageKeyword ?? '')).not.toMatch(/Kota Kinabalu|Fireflies/i)
    expect(String(day3?.imageKeyword ?? '')).toMatch(/Lake Rotorua|Rotorua/i)
    expect(String(day3?.imageKeyword2 ?? '')).toMatch(/Agrodome|Skyline|Whakarewarewa/i)
    const day4 = out.find((r) => r.day === 4)
    expect(String(day4?.imageKeyword ?? '')).toMatch(/Mission Bay/i)
  })
})
