/**
 * empty7: hanatour optional-only day + htlInfoList — empty7
 * Sample: pkg-hn-0203 (pkgCd=AVP258270105LJD). card/hotel strings from
 * refetch itnr sha256 275df91529cacc04dfe122a02af7131176a9240f7b914a02af775e9b53cc5137.
 */
import { describe, expect, it } from 'vitest'
import {
  hanatourFactDaysToRegisterSchedule,
  hanatourItnrSchdToFactDays,
} from '@/lib/hanatour-register-api-detail'

describe('hanatour empty7 optional-only day places', () => {
  it('uses 선택관광 labels when 관광지 empty and maps htlInfoList (pkg-hn-0203 day3)', () => {
    const facts = hanatourItnrSchdToFactDays([
      {
        schdDay: 3,
        htlInfoList: [{ htlKoNm: '래디슨 블루 리조트 푸꾸옥' }],
        schdMainInfoList: [
          {
            schdCatgNm: '선택관광',
            cardNm: '선월드(혼똔섬) 케이블카 & 워터파크(망고레스토랑 식사권)',
            cmsInfoList: [
              { cmsCntntNm: '선월드(혼똔섬) 케이블카 & 워터파크(망고레스토랑 식사포함)' },
            ],
          },
          {
            schdCatgNm: '선택관광',
            cardNm: '푸꾸옥 남부 야경투어(식사비용제공)',
            cmsInfoList: [{ cmsCntntNm: '푸꾸옥 남부 선셋투어(식사비용제공)' }],
          },
        ],
      },
    ])
    expect(facts[0]?.places.join(' ')).toMatch(/선월드|혼똔/)
    expect(facts[0]?.hotels[0]).toMatch(/래디슨/)
    const sched = hanatourFactDaysToRegisterSchedule(facts)
    expect(sched[0]?.title).toMatch(/선월드|혼똔|야경/)
    expect(sched[0]?.description.length).toBeGreaterThan(10)
    expect(sched[0]?.description).toMatch(/망고레스토랑|선셋|야경/)
  })
})
