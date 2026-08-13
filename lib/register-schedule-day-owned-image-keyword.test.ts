/**
 * REGRESSION-FREEZE[register-schedule-day-owned-image-keyword]: 당일 routeText만 — 타 일차 landmark 금지
 * REGRESSION-FREEZE[register-schedule-day-owned-image-keyword]: Iberia·남프랑스 ESP104 day-owned POI — manifest
 * REGRESSION-FREEZE[register-schedule-day-owned-image-keyword]: 홍콩 디즈니랜드 ≠ Tokyo/Shanghai — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
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
    // return hub soft-dup visit city (뉴욕) before unused landmark — freeze return hub soft-dup
    expect(String(byDay.get(10)?.imageKeyword ?? '')).toMatch(/Central Park|Rockefeller|9\/11|Charging Bull|New York/i)

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

const ESP104_IBERIA_SCHEDULE = [
  { day: 1, routeText: null as string | null, imageKeyword: '', imageKeyword2: null as string | null },
  {
    day: 2,
    routeText: '니스 - 마세나 광장 - 아비뇽 교황청',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    routeText: '모나코 - 그랑카지노 - 모나코 성당',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    routeText: '아를 - 아를 구시가지 - 마세나 광장',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    routeText: '바르셀로나 - 사그라다 파밀리아 - 구엘공원 - 몬세라트 수도원',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    routeText: '마드리드왕궁 - 프라도미술관 - 푸에르타 델 솔',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 7,
    routeText: '톨레도 - 톨레도 대성당 - 산토 토메교회',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 8,
    routeText: '그라나다 - 세비야 - 알함브라궁전 - 스페인광장 - 히랄다탑 - 세비야 대성당 - 황금의탑',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 9,
    routeText: '알가르베 - 파티마 - 베나길 해변 - 파티마 대성당',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 10,
    routeText: '리스본 - 까보다로카 - 에두아드로 7세 공원 - 제로니모스 수도원 - 벨렘탑 - 리베르다데 거리',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 11,
    routeText: '니스 - 마세나 광장 - 아비뇽 교황청',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 12, routeText: null, imageKeyword: '', imageKeyword2: null },
]

describe('ModeTour ESP104 Iberia — day-owned imageKeyword', () => {
  // REGRESSION-FREEZE[register-schedule-day-owned-image-keyword]: Iberia·남프랑스 ESP104 day-owned POI — manifest
  it('modetour ESP104EKNL-like — no Sagrada/Granada/Toledo cross-day bleed', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(ESP104_IBERIA_SCHEDULE, {
      supplierKey: 'modetour',
      productDestination: '니스 · 마세나 광장 외 13도시',
      productTitle: '스페인 포르투갈 남프랑스 모나코 12일',
    })
    const byDay = new Map(out.map((r) => [r.day, r]))
    const blob = (d: number) =>
      `${String(byDay.get(d)?.imageKeyword ?? '')} | ${String(byDay.get(d)?.imageKeyword2 ?? '')}`

    expect(blob(2)).toMatch(/Nice|Massena|Avignon|Popes/i)
    expect(blob(3)).toMatch(/Monaco|Monte Carlo/i)
    expect(blob(3)).not.toMatch(/Sagrada|Toledo|Alhambra|Granada/i)
    expect(blob(4)).toMatch(/Arles/i)
    expect(blob(5)).toMatch(/Sagrada|Guell|Montserrat|Barcelona/i)
    expect(blob(6)).toMatch(/Prado|Royal Palace Madrid|Puerta del Sol/i)
    expect(blob(6)).not.toMatch(/Plaza Mayor/i)
    expect(blob(7)).toMatch(/Toledo|Santo Tome/i)
    expect(blob(7)).not.toMatch(/Sagrada|Montserrat|Guell/i)
    expect(blob(8)).toMatch(/Alhambra|Giralda|Seville Cathedral|Plaza de Espana Seville|Torre del Oro/i)
    expect(blob(8)).not.toMatch(/Guam/i)
    expect(blob(9)).toMatch(/Fatima|Benagil|Algarve/i)
    expect(blob(9)).not.toMatch(/Granada|Alhambra|Sagrada|Toledo/i)
    expect(blob(10)).toMatch(/Jeronimos|Belem|Cabo da Roca|Lisbon/i)
    expect(blob(11)).toMatch(/Nice|Massena|Avignon|Popes/i)
    expect(blob(11)).not.toMatch(/Toledo|Sagrada|Alhambra/i)
  })
})

const AHP406_HK_DISNEY_SCHEDULE = [
  { day: 1, routeText: '인천 - 홍콩', imageKeyword: '', imageKeyword2: null as string | null },
  { day: 2, routeText: '홍콩 디즈니랜드', imageKeyword: '', imageKeyword2: null },
  {
    day: 3,
    routeText: '헐리우드로드 - 미드레벨 에스컬레이터 - 소호거리 - 웡타이신 사원 - 빅토리아 피크트램 - 빅토리아 산정',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 4, routeText: '홍콩 - 인천', imageKeyword: '', imageKeyword2: null },
]

describe('ModeTour AHP406 Hong Kong Disney — day-owned imageKeyword', () => {
  // REGRESSION-FREEZE[pexels-hk-hollywood-road-not-la]: 헐리우드로드 ≠ LA Hollywood — manifest
  it('헐리우드로드 maps to Hollywood Road Hong Kong not LA', () => {
    expect(mapKoreanPoiSegment('헐리우드로드')).toBe('Hollywood Road Hong Kong')
    expect(mapKoreanPoiSegment('할리우드로드')).toBe('Hollywood Road Hong Kong')
    expect(firstMatchingScheduleSpotEn('헐리우드로드')).toBe('Hollywood Road Hong Kong')
    expect(firstMatchingScheduleSpotEn('할리우드 로드')).toBe('Hollywood Road Hong Kong')
    expect(firstMatchingScheduleSpotEn('Hollywood Road')).toBe('Hollywood Road Hong Kong')
  })

  // REGRESSION-FREEZE[register-schedule-day-owned-image-keyword]: 홍콩 디즈니랜드 ≠ Tokyo/Shanghai — manifest
  it('modetour AHP406KEDT live order — D3 Lantau Disney must not take Peak Tram from D1 core tour', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          routeText: '홍콩 - 헐리우드로드 - 미드레벨에스컬레이터 - 소호거리 - 타이쿤 - 빅토리아 피크트램 (편도)',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 2, routeText: '홍콩 - 구룡(九龍) - 웡타이신사원', imageKeyword: '', imageKeyword2: null },
        { day: 3, routeText: '란타우섬 - 홍콩 디즈니랜드 - 빅토리아 피크트램', imageKeyword: '', imageKeyword2: null },
        { day: 4, routeText: '인천', imageKeyword: '', imageKeyword2: null },
      ],
      {
        supplierKey: 'modetour',
        productDestination: '홍콩',
        productTitle: '[출발확정] 홍콩 디즈니랜드+핵심투어+반일자유 3박4일',
      },
    )
    const byDay = new Map(out.map((r) => [r.day, r]))
    expect(String(byDay.get(3)?.routeText ?? '')).toMatch(/디즈니|란타우/)
    expect(String(byDay.get(3)?.routeText ?? '')).not.toMatch(/피크|Peak|소호|헐리우드|타이쿤/i)
    const d3 = `${String(byDay.get(3)?.imageKeyword ?? '')} | ${String(byDay.get(3)?.imageKeyword2 ?? '')}`
    expect(d3).toMatch(/Hong Kong Disneyland/i)
    expect(d3).not.toMatch(/Victoria Peak|Peak Tram|SoHo|Hollywood|Tai Kwun|Escalator/i)
    const d1 = `${String(byDay.get(1)?.imageKeyword ?? '')} | ${String(byDay.get(1)?.imageKeyword2 ?? '')}`
    expect(d1).toMatch(/Victoria Peak|Peak Tram|SoHo|Hollywood Road Hong Kong|Tai Kwun|Escalator/i)
    expect(d1).not.toMatch(/Disneyland|Los Angeles|Hollywood Sign/i)
    expect(d1.replace(/Hollywood Road Hong Kong/gi, '')).not.toMatch(/Hollywood Road/i)
  })

  // REGRESSION-FREEZE[pexels-hk-hollywood-road-not-la]: 란타우 only + 상품명 디즈니 → D3 HK Disney — manifest
  it('modetour AHP406KEDT — Lantau-only route + productTitle 디즈니 restores HK Disneyland', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          routeText: '홍콩 - 헐리우드로드 - 미드레벨에스컬레이터 - 소호거리 - 타이쿤 - 빅토리아 피크트램 (편도)',
          imageKeyword: 'Hollywood Road',
          imageKeyword2: null,
        },
        { day: 2, routeText: '홍콩 - 구룡(九龍) - 웡타이신사원', imageKeyword: '', imageKeyword2: null },
        { day: 3, routeText: '란타우섬', imageKeyword: '', imageKeyword2: null },
        { day: 4, routeText: '인천', imageKeyword: '', imageKeyword2: null },
      ],
      {
        supplierKey: 'modetour',
        productDestination: '홍콩',
        productTitle: '[출발확정] 홍콩 디즈니랜드+핵심투어+반일자유 3박4일',
      },
    )
    const byDay = new Map(out.map((r) => [r.day, r]))
    expect(String(byDay.get(3)?.routeText ?? '')).toMatch(/디즈니/)
    const d3 = `${String(byDay.get(3)?.imageKeyword ?? '')} | ${String(byDay.get(3)?.imageKeyword2 ?? '')}`
    expect(d3).toMatch(/Hong Kong Disneyland/i)
    expect(d3).not.toMatch(/Tokyo|Shanghai|Peak Tram|Hollywood/i)
    const d1 = `${String(byDay.get(1)?.imageKeyword ?? '')} | ${String(byDay.get(1)?.imageKeyword2 ?? '')}`
    expect(d1).toMatch(/Hollywood Road Hong Kong/i)
    expect(d1).not.toMatch(/Los Angeles/i)
  })

  it('modetour AHP406KEDT-like — Disney day is HK not Tokyo/Shanghai; Peak stays on core-tour day', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(AHP406_HK_DISNEY_SCHEDULE, {
      supplierKey: 'modetour',
      productDestination: '홍콩',
      productTitle: '[출발확정] 홍콩 디즈니랜드+핵심투어+반일자유 3박4일',
    })
    const byDay = new Map(out.map((r) => [r.day, r]))
    const blob = (d: number) =>
      `${String(byDay.get(d)?.imageKeyword ?? '')} | ${String(byDay.get(d)?.imageKeyword2 ?? '')}`

    expect(blob(2)).toMatch(/Hong Kong Disneyland/i)
    expect(blob(2)).not.toMatch(/Tokyo|Shanghai/i)
    expect(blob(2)).not.toMatch(/Victoria Peak|SoHo|Wong Tai Sin/i)
    expect(blob(3)).toMatch(/Victoria Peak|Peak Tram|SoHo|Hollywood|Wong Tai Sin|Tai Kwun|Escalator/i)
    expect(blob(3)).not.toMatch(/Tokyo|Shanghai|Disneyland/i)
  })
})
