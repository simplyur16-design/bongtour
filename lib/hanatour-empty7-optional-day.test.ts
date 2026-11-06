/**
 * empty7: hanatour optional-only day + htlInfoList ??empty7
 */
import { describe, expect, it } from 'vitest'
import {
  hanatourFactDaysToRegisterSchedule,
  hanatourItnrSchdToFactDays,
} from '@/lib/hanatour-register-api-detail'

describe('hanatour empty7 optional-tour day places', () => {
  it('uses ?좏깮愿愿?labels when 愿愿묒? empty and maps htlInfoList', () => {
    const facts = hanatourItnrSchdToFactDays([
      {
        schdDay: 3,
        htlInfoList: [{ htlKoNm: '?섎뵒??釉붾（ 由ъ“???멸씀?? }],
        schdMainInfoList: [
          {
            schdCatgNm: '?좏깮愿愿?,
            cardNm: "?좎썡???쇰삍?? 耳?대툝移?& ?뚰꽣?뚰겕",
            cmsInfoList: [{ cmsCntntNm: '?좎썡???쇰삍?? 耳?대툝移?& ?뚰꽣?뚰겕(留앷퀬?덉뒪?좊옉 ?앹궗?ы븿)' }],
          },
          {
            schdCatgNm: '?좏깮愿愿?,
            cardNm: '?멸씀???⑤? ?쇨꼍?ъ뼱(?앹궗鍮꾩슜?쒓났)',
            cmsInfoList: [{ cmsCntntNm: '?멸씀???⑤? ?좎뀑?ъ뼱' }],
          },
        ],
      },
    ])
    expect(facts[0]?.places.join(' ')).toMatch(/?좎썡???쇰삍/)
    expect(facts[0]?.hotels[0]).toMatch(/?섎뵒??)
    const sched = hanatourFactDaysToRegisterSchedule(facts)
    expect(sched[0]?.title).toMatch(/?좎썡???쇰삍|?쇨꼍/)
    expect(sched[0]?.description.length).toBeGreaterThan(10)
  })
})
