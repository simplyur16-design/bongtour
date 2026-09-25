/**
 * REGRESSION-FREEZE[register-pending-quality-keyword-desc-departure]
 */
import { describe, expect, it } from 'vitest'
import { isBrokenRegisterScheduleDescription } from '@/lib/register-pre-photo-guards'
import { isRegisterPrePhotoPlaceLikeDestination } from '@/lib/register-schedule-cross-continent-keyword-guard'
import { enforceRegisterScheduleTripUniqueImageKeywords } from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { verifyRegisterPrePhoto } from '@/lib/register-pre-photo-verify'

describe('register-pending-quality-keyword-desc-departure', () => {
  it('soft-dup bare city yields to unused route landmark', () => {
    const rows = enforceRegisterScheduleTripUniqueImageKeywords([
      {
        day: 1,
        routeText: '인천 - 코타키나발루',
        imageKeyword: 'Kota Kinabalu',
        imageKeyword2: null,
      },
      {
        day: 2,
        routeText: '코타키나발루 시티모스크',
        imageKeyword: 'Kota Kinabalu',
        imageKeyword2: 'Pink Mosque Kota Kinabalu',
      },
      {
        day: 3,
        routeText: '코타키나발루 자유',
        imageKeyword: 'Kota Kinabalu',
        imageKeyword2: null,
      },
      {
        day: 4,
        routeText: '코타키나발루 호핑',
        imageKeyword: 'Kota Kinabalu',
        imageKeyword2: null,
      },
      {
        day: 5,
        routeText: '코타키나발루 - 인천',
        imageKeyword: 'Kota Kinabalu',
        imageKeyword2: null,
      },
    ])
    const day2 = String(rows.find((r) => r.day === 2)?.imageKeyword ?? '')
    expect(/Mosque|Kinabalu/i.test(day2)).toBe(true)
    const middleBareDup = rows
      .filter((r) => r.day >= 2 && r.day <= 4)
      .filter((r) => String(r.imageKeyword ?? '').trim() === 'Kota Kinabalu')
    // 2nd+ middle bare soft-dup without landmark must not pile up
    expect(middleBareDup.length).toBeLessThanOrEqual(1)
  })

  it('rejects promo destinations even when title is place-like', () => {
    expect(isRegisterPrePhotoPlaceLikeDestination('옐로팡딜')).toBe(false)
    expect(isRegisterPrePhotoPlaceLikeDestination('전 일정 특급 호텔')).toBe(false)
    const v = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '[옐로팡딜]푸꾸옥 패키지 3박5일',
      productDestination: '옐로팡딜',
      rows: [
        { day: 1, routeText: '인천 - 푸꾸옥', imageKeyword: 'Phu Quoc', description: '인천에서 출발해 푸꾸옥에 도착합니다. 첫날 일정을 이어갑니다.' },
        { day: 2, routeText: '그랜드월드', imageKeyword: 'Grand World', description: '그랜드월드를 둘러봅니다. 동선에 맞춰 하루 일정을 이어갑니다.' },
        { day: 3, routeText: '푸꾸옥 - 인천', imageKeyword: 'Phu Quoc', description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.' },
      ],
    })
    expect(v.issues).toContain('destination_placeholder')
  })

  it('marks summary broken when non-hub route places are missing', () => {
    expect(
      isBrokenRegisterScheduleDescription(
        '현지 리듬에 맞춰 하루를 보냅니다. 동선에 맞춰 하루 일정을 이어갑니다.',
        '페트라 - 와디럼',
      ),
    ).toBe(true)
    expect(
      isBrokenRegisterScheduleDescription(
        '페트라를 둘러봅니다. 와디럼으로 이동합니다.',
        '페트라 - 와디럼',
      ),
    ).toBe(false)
  })

  it('flags keyword2 bleed across middle days', () => {
    const v = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '보천+태항대협곡 5일',
      productDestination: '태항산',
      rows: [
        { day: 1, routeText: '인천 - 정주', imageKeyword: 'Zhengzhou', description: '정주에 도착합니다. 첫날 일정을 이어갑니다.' },
        {
          day: 2,
          routeText: '태항대협곡 - 천계산',
          imageKeyword: 'Taihang Mountains Canyon',
          imageKeyword2: 'Tianji Mountain',
          description: '태항대협곡과 천계산을 둘러봅니다. 산과 호수 풍경으로 하루를 이어갑니다.',
        },
        {
          day: 3,
          routeText: '팔리구',
          imageKeyword: 'Taihang Mountains Canyon',
          imageKeyword2: null,
          description: '팔리구를 둘러봅니다. 산과 호수 풍경으로 하루를 이어갑니다.',
        },
        { day: 4, routeText: '정주 - 인천', imageKeyword: 'Zhengzhou', description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.' },
      ],
    })
    expect(v.issues.some((i) => /bleed_other_day/.test(i))).toBe(true)
  })
})
