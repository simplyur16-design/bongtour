import { describe, expect, it } from 'vitest'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { isRegisterScheduleCrossContinentHallucinationKeyword } from '@/lib/register-schedule-cross-continent-keyword-guard'
import { composeLottetourScheduleDescription } from '@/lib/lottetour-register-api-schedule'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'
import { composeMarketingProductTitle } from '@/lib/bongtour-product-title-marketing-compose'

// REGRESSION-FREEZE[lottetour-singapore-register-quality]: B05A 싱가포르 — USJ 금지·USS/Gardens·출귀국 adjacent·바쿠테 — manifest

describe('lottetour Singapore register quality', () => {
  it('maps 유니버설 스튜디오 싱가포르 → Universal Studios Singapore (not Japan)', () => {
    expect(firstMatchingScheduleSpotEn('유니버설 스튜디오 싱가포르')).toMatch(/Universal Studios Singapore/i)
    expect(firstMatchingScheduleSpotEn('가든스 바이 더 베이')).toMatch(/Gardens by the Bay/i)
    expect(firstMatchingScheduleSpotEn('오사카 유니버설 스튜디오')).toMatch(/Universal Studios Japan/i)
  })

  it('does not map 바쿠테 (bakute) to Flame Towers Baku', () => {
    expect(String(firstMatchingScheduleSpotEn('바쿠테 [송파]') ?? '')).not.toMatch(/Flame Towers|Baku|Azerbaijan/i)
    expect(String(firstMatchingScheduleSpotEn('바쿠 올드시티') ?? '')).toMatch(/Flame Towers Baku/i)
  })

  it('blocks Universal Studios Japan and Flame Towers on Singapore trip', () => {
    const rows = [{ day: 3, routeText: '유니버설 스튜디오 싱가포르', title: '싱가포르' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Universal Studios Japan',
        '싱가포르',
        rows,
      ),
    ).toBe(true)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Flame Towers Baku Azerbaijan',
        '싱가포르',
        rows,
      ),
    ).toBe(true)
  })

  it('does not reuse the same generic_tourism description for USS vs gardens days', () => {
    const uss = composeLottetourScheduleDescription({
      day: 3,
      maxDay: 5,
      routePlaces: ['유니버설 스튜디오 싱가포르'],
      joinedBlob: '유니버설 스튜디오 싱가포르 - 입장권',
    })
    const gardens = composeLottetourScheduleDescription({
      day: 2,
      maxDay: 5,
      routePlaces: ['싱가포르', '가든스 바이 더 베이'],
      joinedBlob: '싱가포르 - 가든스 바이 더 베이 - 센토사',
    })
    expect(uss).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
    expect(gardens).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
    expect(uss).not.toBe(gardens)
  })

  it('apply keywords — Day3 USS not Japan; Gardens/Merlion from route', () => {
    const out = applyLottetourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '싱가포르',
          description: '',
          routeText: '싱가포르 - 머라이언 - 센토사',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '유니버설 스튜디오 싱가포르',
          description: '',
          routeText: '유니버설 스튜디오 싱가포르 - 입장권 사전 신청 가능',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      { productDestination: '싱가포르', productTitle: '싱가포르 5일' },
    )
    expect(out[1]?.imageKeyword).toMatch(/Universal Studios Singapore/i)
    expect(String(out[1]?.imageKeyword2 ?? '')).not.toMatch(/Japan/i)
    expect([out[0]?.imageKeyword, out[0]?.imageKeyword2].join(' ')).toMatch(/Merlion|Sentosa/i)
  })

  it('Day1/Day5 adjacent — unused landmark from next/prev tourism day (B05A shape)', () => {
    const out = applyLottetourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '싱가포르',
          description: '싱가포르 입국시 유의사항 SG Arrival Card',
          routeText: '싱가포르',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '싱가포르',
          description: '가든스 바이 더 베이 머라이언공원 센토사',
          routeText: '싱가포르 - 가든스 바이 더 베이 - 머라이언 - 센토사',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '유니버설 스튜디오 싱가포르',
          description: '',
          routeText: '유니버설 스튜디오 싱가포르',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '싱가포르',
          description: '머라이언공원 에스플러네이드 차이나타운 센토사 섬 바쿠테 [송파]',
          routeText: '싱가포르 - 칠리크랩 - 송파',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '숙박 없음(귀국)',
          description: '즐거운 여행이 되셨길 바랍니다',
          routeText: '',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      { productDestination: '싱가포르', productTitle: '싱가포르 5일' },
    )
    const d1 = String(out[0]?.imageKeyword ?? '')
    const d2 = [out[1]?.imageKeyword, out[1]?.imageKeyword2].map((x) => String(x ?? '')).filter(Boolean)
    const d4 = [out[3]?.imageKeyword, out[3]?.imageKeyword2].map((x) => String(x ?? '')).filter(Boolean)
    const d5 = String(out[4]?.imageKeyword ?? '')

    expect(d1).toBeTruthy()
    expect(d1).not.toMatch(/^(Singapore|싱가포르)$/i)
    expect(d2.join(' ')).not.toContain(d1)

    expect(d4.join(' ')).toMatch(/Merlion|Esplanade|Chinatown|Sentosa|Gardens/i)
    expect(d4.join(' ')).not.toMatch(/Flame Towers|Baku/i)

    expect(d5).toBeTruthy()
    expect(d5).not.toMatch(/^(Singapore|싱가포르)$/i)
    expect(d5).not.toMatch(/Flame Towers|Baku/i)
    expect(d4.map((x) => x.toLowerCase())).not.toContain(d5.toLowerCase())
  })

  it('R-5 compose — Singapore title keeps highlight not just N nights', () => {
    const title = composeMarketingProductTitle({
      originalProductTitle:
        "[KE][롯데관광'단독][NO쇼핑][나다운 여행을 떠난다면] 싱가포르 5일▶[하루자유][가든스바이더베이 2돔&버드 파라다이스]",
      destination: '싱가포르',
      duration: '3박 5일',
    })
    expect(title).toMatch(/싱가포르/)
    expect(title).toMatch(/3박\s*5일/)
    expect(title).toMatch(/하루자유|가든스바이더베이/)
    expect(title.length).toBeGreaterThan(12)
  })
})
