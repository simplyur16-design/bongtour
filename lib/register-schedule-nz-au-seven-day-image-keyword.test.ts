/**
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]
 * 운영 NZ/AU 7일 — routeText 없는 출발·귀국, Day5 bare city kw2 금지.
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

const NZ_AU_SEVEN_DAY = [
  { day: 1, description: '인천', routeText: null, imageKeyword: '', imageKeyword2: null },
  {
    day: 2,
    routeText:
      '쿠메우 지역 와이너리 방문 & 시음 - 쿠메우 지역 와이너리 방문 &amp; 시음 - 폴리네시안 스파',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    routeText:
      '로토루아 호수 - 아그로돔 양털깎이쇼&팜투어 - 아그로돔 팜투어 - 🚠스카이라인 곤돌라 + 뷔페중식 - 로토루아 스카이라인 뷔페 - 로토루아 스카이라인 중식 - 와카레와레와 마오리민속마을',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    routeText: '오클랜드 - 미션베이 - 마이클 조셉 세비지 기념공원 - 에덴돩산',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    routeText:
      '시드니 동물원 - 쿼카 - 시드니주 코알라와 사진3 - 캥거루 - 블루마운틴 국립공원 관광 - 세 자매봉 - 에코 포인트',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    routeText:
      '시드니 랜드마크 투어 - 시드니 오페라하우스 내부 투어 - 시드니 하버 브리지 - 세인트 매리 대성당 - 세인트 메리스 대성당 - 시드니 로얄 보타닉 가든 - 로얄 보타닉 가든',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 7, description: '시드니', routeText: null, imageKeyword: '', imageKeyword2: null },
]

describe('register-schedule-nz-au-seven-day-image-keyword', () => {
  it('modetour NZ/AU 7일 — hub-only 출발·귀국 채움, Day5 kw2≠Sydney', { timeout: 20_000 }, () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(NZ_AU_SEVEN_DAY, {
      supplierKey: 'modetour',
      productDestination: '뉴질랜드',
      productTitle: '뉴질랜드 호주',
    })
    const d1 = out.find((r) => r.day === 1)
    const d2 = out.find((r) => r.day === 2)
    const d5 = out.find((r) => r.day === 5)
    const d7 = out.find((r) => r.day === 7)

    expect(String(d1?.imageKeyword ?? '')).toMatch(/Kumeu|Polynesian|Valley/i)
    expect(String(d2?.imageKeyword ?? '')).toMatch(/Kumeu|Polynesian|Valley/i)
    expect(String(d2?.imageKeyword ?? '')).not.toMatch(/^Kumeu Wine$/i)

    expect(String(d5?.imageKeyword ?? '')).toMatch(/Taronga Zoo|Blue Mountains/i)
    expect(String(d5?.imageKeyword2 ?? '')).toMatch(/Three Sisters|Echo Point|Blue Mountains/i)
    expect(String(d5?.imageKeyword2 ?? '')).not.toMatch(/^Sydney$/i)

    // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return soft-dup visit city — manifest
    // routeText 없는 귀국 — 미사용 Opera House bleed 대신 bare Sydney soft-dup
    expect(String(d7?.imageKeyword ?? '')).toMatch(
      /^(?:Sydney|Opera House|Harbour Bridge|Blue Mountains|Three Sisters|Botanic|Taronga|Memorial|Mission Bay|Rotorua|Agrodome|St Marys)/i,
    )
  })
})