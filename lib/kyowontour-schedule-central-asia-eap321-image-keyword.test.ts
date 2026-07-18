/**
 * REGRESSION-FREEZE[kyowontour-schedule-expression]: EAP321 — 악수온천≠일본 · Day6≠Gur-e Amir bleed — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: EAP321 Minor/Chorsu/Charyn short EN — manifest
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: central Asia before japan onsen — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: 특식·기차역 route noise — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyKyowontourScheduleExpressionToRows } from '@/lib/kyowontour-register-api-schedule'
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import {
  isRegisterScheduleRoutePlaceNoise,
  sanitizeRegisterScheduleRouteText,
} from '@/lib/register-schedule-route-place-noise'
import { composeRegisterScheduleExtendedRegionVibeDescription } from '@/lib/register-schedule-region-vibe-extended'

describe('kyowontour Central Asia EAP321 route + imageKeyword + vibe', () => {
  it('maps Tashkent/Almaty/Issyk landmarks; 악수온천 is Central Asia not Japan', () => {
    expect(firstMatchingScheduleSpotEn('미노르 모스크')).toMatch(/^Minor Mosque$/i)
    expect(firstMatchingScheduleSpotEn('초르수 바자르')).toMatch(/^Chorsu Bazaar$/i)
    expect(firstMatchingScheduleSpotEn('차른캐년')).toMatch(/^Charyn Canyon$/i)
    expect(firstMatchingScheduleSpotEn('루나캐년')).toMatch(/^Luna Canyon$/i)
    expect(firstMatchingScheduleSpotEn('악수온천')).toMatch(/Aksu/i)

    const onsenDay = composeRegisterScheduleExtendedRegionVibeDescription(
      ['블랙캐년', '악수온천'],
      '블랙캐년 - 루나캐년 - 차른캐년 협곡 - 악수온천',
    )
    expect(onsenDay).toMatch(/중앙아시아/)
    expect(onsenDay).not.toMatch(/일본/)
  })

  it('strips 특식 / 기차역 / 공항 from Central Asia route', () => {
    expect(isRegisterScheduleRoutePlaceNoise('특식 : 삼사')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('기차역')).toBe(true)
    expect(
      sanitizeRegisterScheduleRouteText(
        '미노르 모스크 - 하르자트 이맘 단지 - 특식: 샤슬릭 - 초르수 바자르',
      ),
    ).toBe('미노르 모스크 - 하르자트 이맘 단지 - 초르수 바자르')
  })

  it('EAP321-like — Day1 Minor not Shah-i-Zinda; Day6 no Gur-e Amir bleed', () => {
    const expressed = applyKyowontourScheduleExpressionToRows([
      {
        day: 1,
        title: '미노르 모스크 · 초르수 바자르',
        description: '',
        routeText: '미노르 모스크 - 하르자트 이맘 단지 - 특식: 샤슬릭 - 초르수 바자르',
        imageKeyword: '',
        imageKeyword2: null as string | null,
      },
      {
        day: 2,
        title: '기차역 · 특식 : 삼사',
        description: '',
        routeText:
          '기차역 - 레기스탄 광장 야경 - 비비하눔 모스크 - 시요브 바자르 - 특식 : 펠메니 - 샤히진다 영묘 - 특식 : 삼사',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '아프로시압 박물관 · 기차역',
        description: '',
        routeText:
          '아프로시압 박물관 - 울루그벡 천문대 - 구르 아미르 묘소 - 실크카펫 팩토리 - 특식 : 플롭 - 기차역',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 6,
        title: '블랙캐년 · 악수온천',
        description: '',
        routeText:
          '블랙캐년 - 루나캐년 - 차른캐년 협곡 트래킹 - 특식 : 라그만&만티 - 카라콜 - 특식 : 꾸르닥 - 악수온천',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])

    expect(expressed[0]?.description ?? '').not.toMatch(/일본/)
    expect(expressed[3]?.description ?? '').toMatch(/중앙아시아/)
    expect(expressed[3]?.description ?? '').not.toMatch(/일본/)
    expect(expressed[0]?.routeText ?? '').not.toMatch(/특식/)

    const withKw = applyKyowontourScheduleImageKeywordsToRows(expressed, {
      productTitle: '중앙아시아 3국 7박9일 우즈베키스탄/카자흐스탄/키르기스스탄',
      productDestination: '중앙아시아',
    })

    const d1 = withKw[0]!
    expect(d1.imageKeyword).toMatch(/Minor Mosque|Hazrati Imam|Chorsu/i)
    expect(String(d1.imageKeyword)).not.toMatch(/Shah|Zinda|Registan/i)

    const d6 = withKw[3]!
    expect(d6.imageKeyword).toMatch(/Charyn|Black Canyon|Luna Canyon|Aksu/i)
    expect(String(d6.imageKeyword)).not.toMatch(/Gur-e Amir|Samarkand/i)
    expect(String(d6.imageKeyword2 ?? '')).not.toMatch(/Gur-e Amir|Samarkand/i)
  })
})
