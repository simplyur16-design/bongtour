/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: UAE EMP340 Day2 — Emirates Palace·왕궁·모스크·분수·에티하드 — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: UAE cluster day-route evidence — EMP340 landmark bleed 금지 — manifest
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: UAE before Bangkok 왕궁 — 아부다비 왕궁≠방콕 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { composeRegisterScheduleExtendedRegionVibeDescription } from '@/lib/register-schedule-region-vibe-extended'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'

describe('modetour UAE EMP340 imageKeyword', () => {
  it('maps Day2 Abu Dhabi POI spots (not hotel-only empty)', () => {
    expect(firstMatchingScheduleSpotEn('에미레이트 팰리스호텔 금커피')).toMatch(/Emirates Palace/i)
    expect(firstMatchingScheduleSpotEn('아부다비 왕궁')).toMatch(/Qasr Al Watan/i)
    expect(firstMatchingScheduleSpotEn('그랜드 모스크')).toMatch(/Sheikh Zayed Grand Mosque/i)
    expect(firstMatchingScheduleSpotEn('에티하드 타워')).toMatch(/Etihad Towers/i)
    expect(firstMatchingScheduleSpotEn('두바이몰 분수쇼')).toMatch(/Dubai Fountain/i)
  })

  it('아부다비 왕궁 day — uae_gulf vibe not Bangkok', () => {
    const blob = '에미레이트 팰리스호텔 금커피+아부다비 왕궁 - 그랜드 모스크 - 두바이몰 분수쇼'
    const desc = composeRegisterScheduleExtendedRegionVibeDescription(
      ['아부다비 왕궁', '그랜드 모스크'],
      blob,
    )
    expect(desc).toMatch(/걸프/i)
    expect(desc).not.toMatch(/방콕/i)

    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 2,
        places: ['아부다비 왕궁', '그랜드 모스크', '두바이몰 분수쇼'],
        hotels: [],
        meals: [],
        transportNote: null,
      },
    ])
    expect(days[0]?.description).toMatch(/걸프/i)
    expect(days[0]?.description).not.toMatch(/방콕/i)
  })

  it('EMP340-like 6-day — Day2 filled; Day3/4 no Abu Dhabi landmark bleed', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, title: '두바이', routeText: '두바이', imageKeyword: '', imageKeyword2: null },
        {
          day: 2,
          title: '에미레이트 팰리스호텔 금커피+아부다비 왕궁 · 두바이 분수쇼 워크브릿지',
          routeText:
            '에미레이트 팰리스호텔 금커피+아부다비 왕궁 - 두바이 - 에티하드 타워 - 그랜드 모스크 - 두바이몰 분수쇼 - 두바이 분수쇼 워크브릿지',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '두바이 · 버즈칼리파 전망대',
          routeText: '두바이 - 버즈칼리파 전망대',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '두바이 · 도우크루즈',
          routeText: '두바이 - 팜주메이라 전망대+BBQ런치 - 도우크루즈 (크루즈 야경+디너)',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '두바이 · 두바이 프레임',
          routeText:
            '두바이 - 사막 낙타 농장 - 자빌 팰리스 - 알 파히디(구 바스타키야) - 금시장(골드수크) - 향신료 시장 - 두바이 프레임',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 6, title: '귀국', routeText: '', imageKeyword: '', imageKeyword2: null },
      ],
      {
        supplierKey: 'modetour',
        productDestination: '두바이',
        productTitle: '두바이/아부다비 일주 6일 <5성급 힐튼/메리어트 or 동급/노팁/노쇼핑/인기옵션 포함>',
        travelScope: 'package',
      },
    )

    const d2 = out.find((r) => r.day === 2)!
    const d2blob = `${d2.imageKeyword ?? ''} ${d2.imageKeyword2 ?? ''}`
    expect(String(d2.imageKeyword ?? '').trim().length).toBeGreaterThan(2)
    expect(d2blob).toMatch(/Emirates Palace|Qasr Al Watan|Grand Mosque|Etihad|Fountain/i)
    expect(d2blob).not.toMatch(/Louvre/i)

    const d3 = out.find((r) => r.day === 3)!
    expect(String(d3.imageKeyword ?? '')).toMatch(/Burj Khalifa/i)
    expect(String(d3.imageKeyword2 ?? '')).not.toMatch(/Mosque|Louvre|Abu Dhabi/i)

    const d4 = out.find((r) => r.day === 4)!
    expect(String(d4.imageKeyword ?? '')).toMatch(/Palm Jumeirah|Dhow/i)
    expect(String(d4.imageKeyword2 ?? '')).not.toMatch(/Louvre/i)

    const d6 = out.find((r) => r.day === 6)!
    expect(String(d6.imageKeyword ?? '')).toMatch(/Dubai/i)
  })
})
