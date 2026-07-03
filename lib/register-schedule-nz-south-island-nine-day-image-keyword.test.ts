/**
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]
 * 운영 NZ 남섬 9일 — routeText 순서·hub-only 출발·귀국, bare city kw2 금지.
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

const NZ_SOUTH_ISLAND_NINE_DAY = [
  { day: 1, description: '인천', routeText: null, imageKeyword: '', imageKeyword2: null },
  {
    day: 2,
    routeText:
      '[뉴질랜드 퀸스타운(Queenstown) 관광] - 카와라우 번지점프대 - 애로우타운 - 카우리번지점프 - 퀸즈타운 가든',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    routeText:
      '피오르드랜드 국립공원 투어 - 거울호수 - 호머 터널 - 뉴질랜드 남섬 관광의 하이라이트 _ 밀포드 사운드 - 밀포드 사운드 - 밀포드 사운드 크루즈 - 밀포드',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    routeText:
      '마운트 쿡 국립공원 - 남섬의 아름다운 대 자연 감상 - 트와이젤 - 켄터베리 대평원 - 선한 양치기의 교회 - 테카포 호수 - 푸카키 호수',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    routeText:
      '크라이스트처치 시내관광 - 해글리 공원 - 에이번 강 - 모나 베일 - 바이아덕트 - 오클랜드 간단 시내탐방 - 마이클 조셉 세비지 기념공원',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    routeText: '해밀턴 가든 - 로토루아 호수 - 하무라나 스프링스',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 7,
    routeText:
      '아그로돔 양털깎이쇼&팜투어 - 아그로돔 팜투어 - 타우포 명소 관광 - 타우포 호수 - 후카폭포 - 타우포 번지점프 - 와이키테 밸리 핫풀',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 8,
    routeText:
      '레드우드 수목원 - 로토루아 레드우드 - 와카레와레와 마오리민속마을 - 마오리족 민속공연',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 9, description: '오클랜드', routeText: null, imageKeyword: '', imageKeyword2: null },
]

describe('register-schedule-nz-south-island-nine-day-image-keyword', () => {
  it('modetour NZ 남섬 9일 — routeText 순서·hub 채움·kw2≠bare city', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(NZ_SOUTH_ISLAND_NINE_DAY, {
      supplierKey: 'modetour',
      productDestination: '뉴질랜드',
      productTitle: '뉴질랜드 남섬',
    })
    const byDay = (d: number) => out.find((r) => r.day === d)

    expect(String(byDay(1)?.imageKeyword ?? '')).toMatch(/Kawarau|Arrowtown|Queenstown|Nevis/i)
    expect(String(byDay(1)?.imageKeyword ?? '')).not.toBe('')

    const d2kw1 = String(byDay(2)?.imageKeyword ?? '')
    const d2kw2 = String(byDay(2)?.imageKeyword2 ?? '')
    expect(d2kw1).toMatch(/Kawarau|Arrowtown|Queenstown|Nevis/i)
    expect(d2kw2).toMatch(/Kawarau|Arrowtown|Queenstown|Nevis/i)
    expect(d2kw1).not.toBe(d2kw2)

    expect(String(byDay(3)?.imageKeyword ?? '')).toMatch(/Milford|Mirror|Homer/i)

    expect(String(byDay(4)?.imageKeyword ?? '')).toMatch(/Mount Cook|Lake Tekapo|Church of Good Shepherd|Pukaki/i)
    expect(String(byDay(4)?.imageKeyword2 ?? '')).toMatch(/Mount Cook|Lake Tekapo|Church of Good Shepherd|Pukaki/i)

    const d5kw1 = String(byDay(5)?.imageKeyword ?? '')
    const d5kw2 = String(byDay(5)?.imageKeyword2 ?? '')
    expect(d5kw1).toMatch(/Hagley|Avon|Mona Vale|Christchurch Tram/i)
    expect(d5kw1).not.toMatch(/Savage Memorial|Michael Joseph/i)
    expect(d5kw2).not.toMatch(/^Christchurch$/i)

    expect(String(byDay(6)?.imageKeyword ?? '')).toMatch(/Hamilton Gardens|Lake Rotorua|Hamurana/i)
    expect(String(byDay(6)?.imageKeyword2 ?? '')).toMatch(/Hamilton Gardens|Lake Rotorua|Hamurana/i)

    expect(String(byDay(7)?.imageKeyword ?? '')).toMatch(/Agrodome|Lake Taupo|Huka|Wai-O-Tapu/i)

    const d8kw2 = String(byDay(8)?.imageKeyword2 ?? '')
    expect(String(byDay(8)?.imageKeyword ?? '')).toMatch(/Redwoods|Whakarewarewa/i)
    expect(d8kw2).not.toMatch(/^Rotorua$/i)

    expect(String(byDay(9)?.imageKeyword ?? '')).not.toBe('')
    expect(String(byDay(9)?.imageKeyword ?? '')).not.toMatch(/^Auckland$/i)
  })

  it('hanatour generic routeText filler — 출발일 forward-fill', () => {
    const filler =
      '하루 동안 여러 장면이 자연스럽게 이어지는, 보기와 걷기가 균형 잡힌 알찬 동선입니다. 특정 장소보다 전체적인 흐름과 분위기를 중심으로 여행의 컨셉을 느끼기 좋은 일정입니다.'
    const rows = [
      { day: 1, routeText: filler, imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        routeText: '카와라우 번지점프대 - 애로우타운 - 퀸즈타운 가든',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    const out = applyRegisterScheduleImageKeywordsBySupplier(rows, {
      supplierKey: 'hanatour',
      productDestination: '뉴질랜드',
    })
    expect(String(out.find((r) => r.day === 1)?.imageKeyword ?? '')).toMatch(/Kawarau|Arrowtown|Queenstown/i)
  })
})
