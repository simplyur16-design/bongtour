/**
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import {
  applyRegisterScheduleRouteTextImageKeywordsToRows,
  collectRouteTextOrderedImageKeywords,
  collectRouteTextOrderedLandmarkKeywords,
} from '@/lib/register-schedule-route-text-image-keyword-ssot'

describe('register-schedule-route-text-image-keyword-ssot', () => {
  it('routeText 세그먼트 순서 — description·schedule_section 미사용', () => {
    const scheduleSectionByDay = new Map<number, string>([
      [3, '선택관광: MD추천 선셋 반딧불이 투어 (코타키나발루)'],
    ])
    const rows = [
      { day: 1, routeText: '인천', imageKeyword: '', imageKeyword2: null },
      {
        day: 3,
        title: '',
        description: '로토루아 — 본문에 반딧불·코타키나발루 오염',
        routeText: '로토루아 호수 - 아그로돔 양털깎이쇼&팜투어 - 🚠스카이라인 곤돌라 - 와카레와레와 마오리민속마을',
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
      scheduleSectionByDay,
    })
    const day3 = out.find((r) => r.day === 3)
    expect(String(day3?.imageKeyword ?? '')).not.toMatch(/Kota Kinabalu|Fireflies/i)
    expect(String(day3?.imageKeyword ?? '')).toMatch(/Rotorua|Whakarewarewa|Agrodome|Skyline/i)
    expect(String(day3?.imageKeyword2 ?? '')).toMatch(/Agrodome|Skyline|Whakarewarewa/i)
    const day4 = out.find((r) => r.day === 4)
    expect(String(day4?.imageKeyword ?? '')).toMatch(/Mission Bay/i)
    expect(day4?.imageKeyword2).toBeNull()
  })

  it('collectRouteTextOrderedImageKeywords — 링컨·나이아가라 routeText 세그먼트 포함', () => {
    const dc = collectRouteTextOrderedImageKeywords(
      '워싱턴 D.C. - 링컨 기념관 - 스미소니언 박물관 - 국회의사당',
    )
    expect(dc.some((x) => /Lincoln Memorial/i.test(x))).toBe(true)
    const niagara = collectRouteTextOrderedImageKeywords('캐나다 나이아가라폭포 - 테이블 락 - 나이아가라 월풀')
    expect(niagara[0]).toMatch(/Niagara/i)
  })

  it('그리스 산토리니·아크로폴리스 routeText — spot scan으로 kw2 후보 2개 이상', () => {
    const santorini = collectRouteTextOrderedLandmarkKeywords(
      '산토리니 정규선 페리 - 피라 마을 - 이아 마을 - 이메로비글리 마을',
    )
    expect(santorini.length).toBeGreaterThanOrEqual(2)
    expect(santorini.some((k) => /Santorini|Fira|Oia/i.test(k))).toBe(true)
    const acropolis = collectRouteTextOrderedLandmarkKeywords(
      '아크로폴리스 - 프로필레아 - 파르테논 신전 - 에렉티온 신전',
    )
    expect(acropolis.length).toBeGreaterThanOrEqual(2)
  })

  it('출발일 routeText 비었을 때 — 다음일 landmark forward-fill', () => {
    const out = applyRegisterScheduleRouteTextImageKeywordsToRows([
      { day: 1, routeText: '', description: '하루 동안 여러 장면이…', imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        routeText: '테살로니키 - 화이트 타워 광장 - 메테오라 수도원',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])
    expect(String(out[0]?.imageKeyword ?? '')).toMatch(/White Tower|Meteora|Thessaloniki/i)
  })

  // REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: AVP7297 departure not Da Lat bleed — manifest
  it('AVP7297-like — D1은 자기 route(깜란/나트랑), 산문 달랏 forward 누수 금지', () => {
    const rows = [
      {
        day: 1,
        title: '깜란',
        routeText: '깜란 - 호텔 - 나트랑',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '나트랑',
        routeText:
          "나트랑 - 참파 유적지 중 가장 오래된 포나가르 참 사원 - 분짜&amp;반쎄오 세트 - 동양의 유럽마을 '달랏 - 달랏 - 에프퍼눈 티 - 달랏 도멘드마리 성당",
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '달랏',
        routeText: '달랏 - 베트남의 민속촌 꾸란마을 - 달랏 화원 생태',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '달랏',
        routeText: '달랏 - 나트랑 - 나트랑 빈펄 하버랜드 야간 - 일정이 끝난 후 공항',
        imageKeyword: '',
        imageKeyword2: null,
      },
      { day: 5, title: '나트랑', routeText: '나트랑', imageKeyword: '', imageKeyword2: null },
    ]
    const out = applyRegisterScheduleImageKeywordsBySupplier(rows, {
      supplierKey: 'ybtour',
      productDestination: '미지정',
      productTitle: '[SK스토아] 나트랑/달랏 5일 #빈펄하버랜드#BX787',
      travelScope: 'package',
    })
    const d1 = String(out.find((r) => r.day === 1)?.imageKeyword ?? '')
    expect(d1).not.toMatch(/Da Lat/i)
    expect(d1).toMatch(/Cam Ranh|Po Nagar|Nha Trang/i)
    const d4 = String(out.find((r) => r.day === 4)?.imageKeyword ?? '')
    expect(d4.length).toBeGreaterThan(0)
    expect(d4).toMatch(/Vinpearl|Harbourland|Harborland|Nha Trang|Po Nagar|Da Lat|Cu Lan|Flower/i)
  })
})
