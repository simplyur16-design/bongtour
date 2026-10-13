/**
 * REGRESSION-FREEZE[register-pre-photo-milan-malpensa-not-duomo]: 말펜사 ≠ 두오모 — manifest
 * REGRESSION-FREEZE[register-pre-photo-hotel-brand-lodging]: Dusit·Henann — manifest
 * REGRESSION-FREEZE[register-pre-photo-port-stephens-aoshima-ssot]: Port Stephens·아오시마 — manifest
 */
import { describe, expect, it } from 'vitest'
import { isBrokenRegisterLandmarkKeyword } from '@/lib/register-pre-photo-guards'
import {
  isBareCityOrCountryKeyword,
  isHotelLodgingImageKeyword,
  isLikelyTourismLandmarkKeyword,
} from '@/lib/pexels-place-name-keyword'
import {
  collectRouteTextOrderedLandmarkKeywords,
} from '@/lib/register-schedule-route-text-image-keyword-ssot'
import { englishFromScheduleKoreanSegment } from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  ownRouteHasKeyword,
  registerScheduleLodgingAllowsDestLandmark,
  registerScheduleLodgingOnlyAllowsSoftDupVisitCity,
  verifyRegisterPrePhoto,
} from '@/lib/register-pre-photo-verify'
import {
  ASIA_PACIFIC_PRODUCT_DEST_RE,
  isRegisterScheduleCrossContinentHallucinationKeyword,
} from '@/lib/register-schedule-cross-continent-keyword-guard'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'

describe('milan malpensa / hotel brand / port stephens aoshima', () => {
  it('Milan Florence Venice are bare visit cities', () => {
    expect(isBareCityOrCountryKeyword('Milan')).toBe(true)
    expect(isBareCityOrCountryKeyword('Florence')).toBe(true)
    expect(isBareCityOrCountryKeyword('Venice')).toBe(true)
    expect(isBrokenRegisterLandmarkKeyword('Milan', { allowHotelLodging: true })).toBe(false)
  })

  it('Malpensa airport route does not invent Duomo/Galleria landmarks', () => {
    const route = '호텔 조식 및 카페 - 밀라노 말펜사 공항 면세점 - 밀라노 말펜사 공항'
    const landmarks = collectRouteTextOrderedLandmarkKeywords(route)
    expect(landmarks.some((k) => /Duomo|Galleria|Sforza/i.test(k))).toBe(false)
    expect(
      ownRouteHasKeyword(route, 'Galleria Vittorio Emanuele Milan'),
    ).toBe(false)
  })

  it('Milan city segment still maps to Duomo', () => {
    expect(englishFromScheduleKoreanSegment('밀라노')).toMatch(/Milan Cathedral|Duomo/i)
  })

  it('Dusit Thani / Henann Tawala are lodging brands', () => {
    expect(isHotelLodgingImageKeyword('Dusit Thani')).toBe(true)
    expect(isHotelLodgingImageKeyword('Henann Tawala')).toBe(true)
    expect(isBrokenRegisterLandmarkKeyword('Dusit Thani', { allowHotelLodging: true })).toBe(
      false,
    )
    expect(isBrokenRegisterLandmarkKeyword('Henann Tawala')).toBe(true)
  })

  it('Nikko Toshogu is landmark not Hotel Nikko; activity day allows dest beach', () => {
    expect(isHotelLodgingImageKeyword('Nikko Toshogu Shrine')).toBe(false)
    expect(isBrokenRegisterLandmarkKeyword('Nikko Toshogu Shrine')).toBe(false)
    expect(isHotelLodgingImageKeyword('Hotel Nikko Tokyo')).toBe(true)
    expect(
      registerScheduleLodgingAllowsDestLandmark(
        '선셋 패들보드 - 패들보드 일출 - 젤 네일 케어',
        'Da Nang My Khe Beach',
        '다낭',
      ),
    ).toBe(true)
  })

  it('Asiana airline title is not Asia dest; Hawaii shopping allows bare soft-dup', () => {
    const hay = '튀르키예 일주 #아시아나항공 튀르키예'
    expect(ASIA_PACIFIC_PRODUCT_DEST_RE.test(hay)).toBe(false)
    expect(isRegisterScheduleCrossContinentHallucinationKeyword('Istanbul', hay, [])).toBe(false)
    expect(
      registerScheduleLodgingOnlyAllowsSoftDupVisitCity(
        "Ross Dress for Less / ABC Stores - Leonard's Bakery - Daniel K. Inouye International Airport",
        'Hawaii',
      ),
    ).toBe(true)
    expect(
      registerScheduleLodgingAllowsDestLandmark(
        '렛츠 릴렉스 스파 - 빅씨 슈퍼센터 - 솜분 씨푸드 - 돈무앙 국제공항',
        'Chatuchak Weekend Market Bangkok',
        '방콕',
      ),
    ).toBe(true)
  })

  it('Wroclaw route rejects Wawel Krakow bleed', () => {
    expect(ownRouteHasKeyword('브로츠와프 - 황금소', 'Wawel Castle Krakow')).toBe(false)
    expect(
      collectRouteTextOrderedLandmarkKeywords('브로츠와프 - 황금소').some((k) =>
        /Wroclaw/i.test(k),
      ),
    ).toBe(true)
  })

  it('Melk Abbey / Wachau fill Austria middle day route', () => {
    const kws = collectRouteTextOrderedLandmarkKeywords(
      '멜크 수도원 - 바하우 계곡 와이너리 - 빈 시내 호텔',
    )
    expect(kws.some((k) => /Melk/i.test(k))).toBe(true)
    expect(kws.some((k) => /Wachau/i.test(k))).toBe(true)
  })

  it('Return day drops FERRY/DAY N and soft-dups visit city', () => {
    const sicily = healRegisterPrePhotoSchedule(
      [
        {
          day: 1,
          routeText: '카타니아',
          imageKeyword: 'Catania',
          imageKeyword2: null,
        },
        {
          day: 10,
          routeText: null,
          imageKeyword: 'FERRY',
          imageKeyword2: null,
          title: '귀국',
        },
      ] as any,
      {
        supplierKey: 'lottetour',
        productDestination: '시칠리아',
        productTitle: '시칠리아 몰타',
        lane: 'package',
        countryKey: 'italy',
      },
    )
    const d10 = String(sicily.rows.find((r) => r.day === 10)?.imageKeyword ?? '')
    expect(d10).not.toMatch(/FERRY|DAY\s*\d+/i)
    expect(d10).toMatch(/Catania|Valletta|Palermo|Sicily|Malta/i)
  })

  it('Sapporo/Jozankei day drops Biei waterfall; spa-only allows bare soft-dup', () => {
    const sapporo = healRegisterPrePhotoSchedule(
      [
        {
          day: 1,
          routeText: '비에이',
          imageKeyword: 'White Beard Falls Biei',
          imageKeyword2: null,
        },
        {
          day: 4,
          routeText: '삿포 - 죠잔케이',
          imageKeyword: 'White Beard Falls Biei',
          imageKeyword2: null,
        },
        {
          day: 5,
          routeText: '귀국',
          imageKeyword: 'Sapporo',
          imageKeyword2: null,
        },
      ] as any,
      {
        supplierKey: 'lottetour',
        productDestination: '삿포로',
        productTitle: '삿포로 후라노 비에이',
        lane: 'package',
        countryKey: 'japan',
      },
    )
    const d4 = String(sapporo.rows.find((r) => r.day === 4)?.imageKeyword ?? '')
    expect(d4).not.toMatch(/Biei|White Beard/i)
    expect(d4).toMatch(/Sapporo|Jozankei/i)
    expect(
      registerScheduleLodgingOnlyAllowsSoftDupVisitCity(
        '렛츠 릴렉스 스파 - 솜분 씨푸드',
        'Bangkok',
      ),
    ).toBe(true)
  })

  it('Port Stephens and Aoshima are valid landmark keywords', () => {
    expect(isLikelyTourismLandmarkKeyword('Port Stephens')).toBe(true)
    expect(isBrokenRegisterLandmarkKeyword('Port Stephens')).toBe(false)
    expect(englishFromScheduleKoreanSegment('아오시마')).toMatch(/Aoshima/i)
    expect(englishFromScheduleKoreanSegment('포트 스티븐스')).toMatch(/Port Stephens/i)
    const portRoute = '포트스티븐스 - 오크베일 동물원 - 머레이 와이너리'
    expect(ownRouteHasKeyword(portRoute, 'Port Stephens')).toBe(true)
    expect(ownRouteHasKeyword(portRoute, 'Sydney')).toBe(false)
  })

  it('FIT heal: Malpensa return → Milan; Sapa day → Silver Waterfall not Hanoi', () => {
    const italy = healRegisterPrePhotoSchedule(
      [
        {
          day: 8,
          routeText: '두오모',
          imageKeyword: 'Milan Cathedral Duomo square',
          imageKeyword2: null,
        },
        {
          day: 9,
          routeText: '호텔 조식 및 카페 - 밀라노 말펜사 공항 면세점 - 밀라노 말펜사 공항',
          imageKeyword: 'Galleria Vittorio Emanuele Milan',
          imageKeyword2: null,
        },
      ] as any,
      {
        supplierKey: 'hanatour',
        productDestination: '이탈리아',
        productTitle: '이탈리아',
        lane: 'air_hotel_free',
      },
    )
    expect(String(italy.rows.find((r) => r.day === 9)?.imageKeyword ?? '')).toMatch(/^Milan$/i)
    const italyV = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      listingKind: 'air_hotel_free',
      productType: 'air-hotel',
      productDestination: '이탈리아',
      productTitle: '이탈리아',
      rows: italy.rows,
    })
    expect(italyV.issues.filter((i) => /keyword|lodging|own_route|empty/i.test(i))).toEqual([])
    const sapa = healRegisterPrePhotoSchedule(
      [
        { day: 1, routeText: 'Hanoi Old Quarter', imageKeyword: 'Hanoi', imageKeyword2: null },
        {
          day: 2,
          routeText: 'Laxsik Ecolodge - Silver Waterfall & Heaven Gate - Sapa Town Restaurant',
          imageKeyword: 'Hanoi',
          imageKeyword2: null,
        },
        { day: 5, routeText: 'Noi Bai Airport', imageKeyword: 'Hanoi', imageKeyword2: null },
      ] as any,
      {
        supplierKey: 'modetour',
        productDestination: '하노이, 사파',
        productTitle: '사파 자유여행',
        lane: 'air_hotel_free',
      },
    )
    expect(String(sapa.rows.find((r) => r.day === 2)?.imageKeyword ?? '')).toMatch(
      /Silver Waterfall|Sapa/i,
    )
    expect(String(sapa.rows.find((r) => r.day === 2)?.imageKeyword ?? '')).not.toMatch(/^Hanoi$/i)
    const sapaV = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      listingKind: 'air_hotel_free',
      productType: 'air-hotel',
      productDestination: '하노이, 사파',
      productTitle: '사파 자유여행',
      rows: sapa.rows,
    })
    expect(sapaV.issues.filter((i) => /keyword|lodging|own_route|empty/i.test(i))).toEqual([])
  })
})
