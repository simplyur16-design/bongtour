/**
 * REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: Hawaii cruise port islands soft — manifest
 * lottetour F05H261017KE005 — 기항지 도시 + 공연관람/부대시설 잡음 → 섬별 imageKeyword
 */
import { describe, expect, it } from 'vitest'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'

const F05H_CRUISE_PORT_ROWS = [
  {
    day: 1,
    title: '호놀룰루 · 공연관람(무료) 및 다양한 부대시설',
    routeText: '호놀룰루 - 공연관람(무료) 및 다양한 부대시설',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 2,
    title: '마우이섬 · 공연관람(무료) 및 다양한 부대시설',
    routeText: '마우이섬 - 공연관람(무료) 및 다양한 부대시설',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '마우이섬 · 공연관람(무료) 및 다양한 부대시설',
    routeText: '마우이섬 - 공연관람(무료) 및 다양한 부대시설',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '힐로 · 공연관람(무료) 및 다양한 부대시설',
    routeText: '힐로 - 공연관람(무료) 및 다양한 부대시설',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    title: '코나 · 공연관람(무료) 및 다양한 부대시설',
    routeText: '코나 - 공연관람(무료) 및 다양한 부대시설',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    title: '카우아이섬 · 공연관람(무료) 및 다양한 부대시설',
    routeText: '카우아이섬 - 공연관람(무료) 및 다양한 부대시설',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 7,
    title: '카우아이섬 · 공연관람(무료) 및 다양한 부대시설',
    routeText: '카우아이섬 - 공연관람(무료) 및 다양한 부대시설',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 8,
    title: '호놀룰루 · 공연관람 및 다양한 부대시설',
    routeText: '호놀룰루 - 공연관람 및 다양한 부대시설',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 9,
    title: '호놀룰루 · 공연관람 및 다양한 부대시설',
    routeText: '호놀룰루 - 공연관람 및 다양한 부대시설',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 10,
    title: '귀국',
    routeText: 'Hawaii',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

describe('lottetour Hawaii cruise port soft-alt keywords', () => {
  it('fills Maui/Hilo/Kona/Kauai port days; no empty middle; island packs stay distinct', () => {
    const out = applyLottetourScheduleImageKeywordsToRows(F05H_CRUISE_PORT_ROWS, {
      productTitle: '【프라이빗 에디션】【비즈니스+발코니】 하와이 골프 & 크루즈 10일 (NCL & KE)',
      productDestination: '하와이',
    })
    const by = (d: number) => out.find((r) => r.day === d)
    const kw = (d: number) => String(by(d)?.imageKeyword ?? '').trim()

    for (const d of [2, 3, 4, 5, 6, 7]) {
      expect(kw(d), `day${d}`).toBeTruthy()
    }

    expect(kw(2)).toMatch(/Maui|Hana|Wailea|Haleakala|Lahaina|Molokini/i)
    expect(kw(3)).toMatch(/Maui|Hana|Wailea|Haleakala|Lahaina|Molokini/i)
    expect(kw(2)).not.toEqual(kw(3))

    expect(kw(4)).toMatch(/Hilo|Volcano|Rainbow|Akaka|Liliuokalani/i)
    expect(kw(5)).toMatch(/Kona|Honaunau|Kealakekua|Kailua/i)
    expect(kw(6)).toMatch(/Kauai|Wailua|Na Pali|Waimea|Poipu|Hanalei/i)
    expect(kw(7)).toMatch(/Kauai|Wailua|Na Pali|Waimea|Poipu|Hanalei/i)
    expect(kw(6)).not.toEqual(kw(7))

    expect(kw(4)).not.toMatch(/Maui|Kauai|Waikiki/i)
    expect(kw(5)).not.toMatch(/Maui|Hilo|Kauai|Waikiki/i)
    expect(kw(6)).not.toMatch(/Maui|Hilo|Kona|Waikiki/i)
  })
})
