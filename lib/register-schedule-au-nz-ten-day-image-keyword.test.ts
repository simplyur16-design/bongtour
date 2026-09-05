/**
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: AU/NZ 10일 — 키워드 반복·일차 누수 금지 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { isRegisterScheduleCrossContinentHallucinationKeyword } from '@/lib/register-schedule-cross-continent-keyword-guard'

const AU_NZ_TEN_DAY = [
  { day: 1, title: '기내박', routeText: '기내박', imageKeyword: '', imageKeyword2: null as string | null },
  {
    day: 2,
    title: '시드니 공항',
    routeText:
      '시드니 공항 - 시드니 - 루라마을 산책 - 19세기 만들어진 가든빌리지로 아기자기한 산악 마을 - 카툼바 - 에코 포인트 - 짙은 원시림으로 뒤덮인 전망대',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '시드니',
    routeText: '시드니 - 시드니 시내 명소 - 시드니 하버 티(Tea) 크루즈 - 시드니의 상징 오페라하우스',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '기상 후 시드니 공항',
    routeText:
      '기상 후 시드니 공항 - 시드니 - 크라이스트 처치 공항 - 크라이스트처치 시내 명소 - 보타닉가든 - 호텔 체크인 및 휴식',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    title: '크라이스트처치',
    routeText: '크라이스트처치 - 마운트쿡 - 푸카키 호수 - 트와이젤 - 테카포 - 양치기 개동상 - 퀸스타운',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    title: '퀸스타운',
    routeText:
      '퀸스타운 - 국립 공원 - 테아나우 - 밀포드 사운드 최고높이를 자랑하는 보웬폭포 - 사자의 모습을 닮은 라이언 마운틴 - 해수면 - 스털링 폭포 감상',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 7,
    title: '퀸스타운 시내',
    routeText: '퀸스타운 시내 - 오클랜드 공항 - 호텔 체크인 및 휴식',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 8,
    title: '오클랜드 간단한 시내',
    routeText:
      '오클랜드 간단한 시내 - 마이클 조셉 세비지 공원 - 오클랜드 스카이타워 - 해밀턴 가든 - 해밀턴 - 로토루아 호수 근처 스파 - 호텔 체크인 및 휴식',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 9,
    title: '로토루아 주요 명소',
    routeText:
      '로토루아 주요 명소 - 가버먼트 가든 - 양,사슴 등 각종 동물 먹이주기 - 아름드리 우거진 레드우드 수목원 - 울창한 레드우드 삼림 - 와까레와레와 마오리 민속촌 - 전통 가옥 및 각종 공예품 관람',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 10,
    title: '기상 후 오클랜드 국제 공항',
    routeText: '기상 후 오클랜드 국제 공항',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

describe('register-schedule-au-nz-ten-day-image-keyword', () => {
  it('hanatour AU/NZ 10일 — D1≠Echo Point, D4≠Blue Mountains, D7≠Milford/Tekapo, D10≠Hamilton', { timeout: 20_000 }, () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(AU_NZ_TEN_DAY, {
      supplierKey: 'hanatour',
      productDestination: '뉴질랜드',
      productTitle: '호주 뉴질랜드 10일',
      travelScope: 'package',
    })
    const by = (d: number) => out.find((r) => r.day === d)
    const d1 = String(by(1)?.imageKeyword ?? '')
    const d2 = String(by(2)?.imageKeyword ?? '')
    const d4 = `${by(4)?.imageKeyword ?? ''} ${by(4)?.imageKeyword2 ?? ''}`
    const d7 = `${by(7)?.imageKeyword ?? ''} ${by(7)?.imageKeyword2 ?? ''}`
    const d10 = String(by(10)?.imageKeyword ?? '')

    expect(d1).not.toMatch(/Echo Point|Blue Mountain/i)
    expect(d1).toMatch(/Sydney|Kumeu|New Zealand|Auckland|Incheon/i)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Echo Point Blue Mountains',
        '뉴질랜드',
        AU_NZ_TEN_DAY,
      ),
    ).toBe(false)
    expect(d2).toMatch(/Echo Point|Blue Mountain|Katoomba|Leura/i)

    expect(d4).toMatch(/Christchurch|Hagley|Botanic/i)
    expect(d4).not.toMatch(/Blue Mountain/i)

    expect(d7).not.toMatch(/Milford|Tekapo|Mount Cook|Christchurch Cathedral/i)
    expect(d7).toMatch(/Queenstown|Auckland/i)

    expect(d10).toMatch(/Auckland/i)
    expect(d10).not.toMatch(/Hamilton Garden|Rotorua|Milford/i)

    // trip-wide: Echo Point는 한 번만 primary
    const echoDays = out.filter((r) => /Echo Point/i.test(String(r.imageKeyword ?? '')))
    expect(echoDays.length).toBeLessThanOrEqual(1)
  })
})
