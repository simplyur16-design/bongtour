import { describe, expect, it } from 'vitest'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import { applyAugmentScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-augment-image-keywords'

describe('isBlockedScheduleImageKeyword', () => {
  it('blocks airport and bare International', () => {
    expect(isBlockedScheduleImageKeyword('Incheon International Airport Departure')).toBe(true)
    expect(isBlockedScheduleImageKeyword('International')).toBe(true)
    expect(isBlockedScheduleImageKeyword('International City Travel Destination')).toBe(true)
    expect(isBlockedScheduleImageKeyword('European Historic City Center Architecture Plaza')).toBe(true)
    expect(isBlockedScheduleImageKeyword('Seoul City Skyline Night')).toBe(true)
    expect(isBlockedScheduleImageKeyword('Nha Trang beach Vietnam')).toBe(false)
  })
})

describe('applyLottetourScheduleImageKeywordsToRows — Nha Trang / Da Lat', () => {
  it('uses destination cities on movement days and fills imageKeyword2 on tourism days', () => {
    const rows = applyLottetourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천 출발 및 나트랑 도착',
          description: '인천 국제공항 출발 후 나트랑 도착',
          routeText: '인천 - 나트랑',
          imageKeyword: 'Incheon International Airport Departure',
        },
        {
          day: 2,
          title: '나트랑 자유 및 달랏 이동',
          description: '나트랑에서 달랏으로 이동',
          routeText: '나트랑 - 달랏',
          imageKeyword: 'International',
        },
        {
          day: 3,
          title: '달랏 전일 관광',
          description: '달랏 꽃 정원',
          routeText: '달랏',
          imageKeyword: 'Da Lat Flower Garden',
        },
      ],
      { productDestination: '베트남' },
    )

    expect(isBlockedScheduleImageKeyword(rows[0]!.imageKeyword ?? '')).toBe(false)
    expect(rows[0]!.imageKeyword).toMatch(/Nha Trang/i)
    expect(rows[0]!.imageKeyword2).toBeNull()

    expect(rows[1]!.imageKeyword).toMatch(/Da Lat|Nha Trang/i)
    expect(rows[1]!.imageKeyword2).not.toBeNull()

    expect(rows[2]!.imageKeyword).toMatch(/Da Lat/i)
  })

  it('return day uses last foreign city — not Incheon airport', () => {
    const rows = applyLottetourScheduleImageKeywordsToRows(
      [
        {
          day: 4,
          title: '달랏 관광 후 나트랑 이동',
          description: '나트랑 공항 출국',
          routeText: '달랏 - 나트랑',
          imageKeyword: 'Po Nagar Cham Towers',
        },
        {
          day: 5,
          title: '인천 국제공항 도착',
          description: '인천 국제공항 도착',
          routeText: '인천',
          imageKeyword: 'Incheon International Airport Departure',
        },
      ],
      { productDestination: '베트남' },
    )
    expect(rows[1]!.imageKeyword2).toBeNull()
    expect(isBlockedScheduleImageKeyword(rows[1]!.imageKeyword ?? '')).toBe(false)
    expect(rows[1]!.imageKeyword).toMatch(/Nha Trang|Po Nagar|Dalat|Da Lat/i)
    expect(rows[1]!.imageKeyword).not.toMatch(/Incheon|International City/i)
  })

  it('Italy package — route landmarks not generic International', () => {
    const rows = applyLottetourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천 출발 및 볼로냐 도착',
          description: '인천 출발 볼로냐 도착',
          routeText: '인천 - 볼로냐',
          imageKeyword: 'Incheon International Airport Departure',
        },
        {
          day: 3,
          title: '피렌체 전일 관광',
          description: '두오모 성당 우피치',
          routeText: '몬테카티니테르메 - 피렌체 - 두오모 성당 - 시뇨리아 광장',
          imageKeyword: 'International City Travel Destination',
        },
        {
          day: 7,
          title: '베니스',
          description: '베니스 관광',
          routeText: '코르티나 담페초 - 베니스',
          imageKeyword: 'European Historic City Center Architecture Plaza',
        },
      ],
      { productDestination: '이탈리아', productTitle: '이탈리아 7박9일' },
    )
    expect(rows[0]!.imageKeyword).toMatch(/Bologna/i)
    expect(rows[0]!.imageKeyword).not.toMatch(/Incheon|International/i)
    expect(rows[1]!.imageKeyword).toMatch(/Florence|Duomo|Uffizi|Signoria/i)
    expect(rows[1]!.imageKeyword).not.toMatch(/International|Europ/i)
    expect(rows[2]!.imageKeyword).toMatch(/Venice|Grand Canal/i)
  })
})

describe('applyAugmentScheduleImageKeywordsBySupplier', () => {
  it('preserves imageKeyword2 for lottetour', () => {
    const out = applyAugmentScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          title: 't',
          description: 'd',
          routeText: '나트랑 - 달랏',
          imageKeyword: 'Nha Trang beach Vietnam',
          imageKeyword2: 'Da Lat Vietnam highland city',
        },
      ],
      { supplierKey: 'lottetour', productTitle: '베트남 5일', productDestination: '베트남' },
    )
    expect(out[0]!.imageKeyword2).toBeTruthy()
    expect(out[0]!.imageKeyword2).not.toBe(out[0]!.imageKeyword)
  })
})
