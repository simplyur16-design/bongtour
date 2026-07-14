import { describe, expect, it } from 'vitest'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { isRegisterScheduleCrossContinentHallucinationKeyword } from '@/lib/register-schedule-cross-continent-keyword-guard'
import { composeLottetourScheduleDescription } from '@/lib/lottetour-register-api-schedule'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'

// REGRESSION-FREEZE[lottetour-singapore-register-quality]: B05A 싱가포르 — USJ 금지·USS/Gardens — manifest

describe('lottetour Singapore register quality', () => {
  it('maps 유니버설 스튜디오 싱가포르 → Universal Studios Singapore (not Japan)', () => {
    expect(firstMatchingScheduleSpotEn('유니버설 스튜디오 싱가포르')).toMatch(/Universal Studios Singapore/i)
    expect(firstMatchingScheduleSpotEn('가든스 바이 더 베이')).toMatch(/Gardens by the Bay/i)
    expect(firstMatchingScheduleSpotEn('오사카 유니버설 스튜디오')).toMatch(/Universal Studios Japan/i)
  })

  it('blocks Universal Studios Japan on Singapore trip', () => {
    const rows = [{ day: 3, routeText: '유니버설 스튜디오 싱가포르', title: '싱가포르' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Universal Studios Japan',
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
})
