/**
 * REGRESSION-FREEZE[register-parse-round2-1031]
 * 1) 1일차 제목 회귀(호텔 주소·리조트명·중복) 2) 기내박=숙박 없음 3) 국가 오추론(단어 경계·목적지 권역)
 * 4) 일차 요약 3~4문장·한글 지명·filler 금지 / 이미지 키워드 같은 날 장소만
 */
import { describe, expect, it } from 'vitest'
import {
  composeRegisterScheduleDayTitleFromRoute,
  isRegisterScheduleLodgingLikeTitleLabel,
  joinRegisterScheduleDayTitlePair,
} from '@/lib/register-schedule-day-title'
import { recoverRegisterScheduleForeignAirportCityStem } from '@/lib/register-schedule-route-place-noise'
import {
  REGISTER_SCHEDULE_INFLIGHT_NO_HOTEL_TEXT,
  isRegisterScheduleInFlightNightLabel,
  normalizeRegisterScheduleDayHotelText,
  registerScheduleHotelTextFromFactHotels,
} from '@/lib/register-schedule-hotel-inflight'
import {
  countryKeyFitsProductDestination,
  registerProductDestinationCountryKeys,
  strongOtherCountryKeysFromHay,
} from '@/lib/register-pre-photo-product-country-schedule-guard'
import { koreanPlaceNameFromEnglish } from '@/lib/pexels-keyword'
import {
  finalizeRegisterPackageScheduleRows,
  finalizeRegisterScheduleDaySummary,
  isRegisterScheduleFillerSentence,
  koreanizeRegisterSchedulePlaceNames,
  restrictRegisterScheduleImageKeywordsToSameDay,
  stripForeignCityQualifierFromKeyword,
} from '@/lib/register-schedule-day-summary-finalize'
import { splitRegisterScheduleDescriptionSentences } from '@/lib/register-schedule-description-characteristic-ssot'

describe('1) 1일차 제목 — 숙소 텍스트·중복 금지', () => {
  it('호텔 주소·전화·리조트명은 제목 라벨이 아니다', () => {
    expect(
      isRegisterScheduleLodgingLikeTitleLabel(
        'IBIS STYLES VILLEPINTE PARC DES EXPOS // ADD : 54 Av. des Nations, 93420 Villepinte // TEL : +33 1 48 63 26 10',
      ),
    ).toBe(true)
    expect(isRegisterScheduleLodgingLikeTitleLabel('두짓타니 막탄 세부 리조트(DUSIT THANI MACTAN CEBU RESORT)')).toBe(true)
    expect(isRegisterScheduleLodgingLikeTitleLabel('호텔이 특급이면 호텔')).toBe(true)
    expect(isRegisterScheduleLodgingLikeTitleLabel('리조트 자유휴양')).toBe(false)
    expect(isRegisterScheduleLodgingLikeTitleLabel('숙박 없음(귀국)')).toBe(false)
    expect(isRegisterScheduleLodgingLikeTitleLabel('베르사유 궁전')).toBe(false)
  })

  it('route 가 비면 숙소 fallback 대신 N일차', () => {
    expect(
      composeRegisterScheduleDayTitleFromRoute({
        day: 1,
        maxDay: 5,
        routeText: '',
        fallbacks: ['두짓타니 막탄 세부 리조트(DUSIT THANI MACTAN CEBU RESORT)'],
      }),
    ).toBe('1일차')
  })

  it('같은(포함) 라벨 두 개는 한 번만', () => {
    expect(joinRegisterScheduleDayTitlePair('앙코르와트 국제 하프 마라톤 입국', '앙코르와트 국제 하프 마라톤 입국')).toBe(
      '앙코르와트 국제 하프 마라톤 입국',
    )
    expect(joinRegisterScheduleDayTitlePair('파리', '파리 시내')).toBe('파리 시내')
    expect(joinRegisterScheduleDayTitlePair('헬라', '스카프타펠')).toBe('헬라 · 스카프타펠')
    // city + its landmark stays a pair (verygoodtour 오사카 · 오사카성)
    expect(joinRegisterScheduleDayTitlePair('오사카', '오사카성')).toBe('오사카 · 오사카성')
    expect(joinRegisterScheduleDayTitlePair('나트랑', '나트랑 야간시티')).toBe('나트랑 야간시티')
  })

  it('해외 공항 도착 구간에서 도시를 살린다 (국내 허브 제외)', () => {
    expect(recoverRegisterScheduleForeignAirportCityStem('파리 공항 도착')).toBe('파리')
    expect(recoverRegisterScheduleForeignAirportCityStem('세부 국제공항 도착')).toBe('세부')
    expect(recoverRegisterScheduleForeignAirportCityStem('인천 국제공항 출발')).toBeNull()
    expect(recoverRegisterScheduleForeignAirportCityStem('공항 미팅 후 출발')).toBeNull()
  })
})

describe('2) 기내박 — 숙박 없음', () => {
  it('기내박 표기는 호텔이 아니다', () => {
    for (const s of ['기내박', '기내 숙박', ': 기내박', '기내1박', 'Overnight flight']) {
      expect(isRegisterScheduleInFlightNightLabel(s)).toBe(true)
    }
    expect(isRegisterScheduleInFlightNightLabel('힐튼 호텔')).toBe(false)
  })
  it('사실 호텔 목록 → hotelText', () => {
    expect(registerScheduleHotelTextFromFactHotels(['기내박'])).toBe(REGISTER_SCHEDULE_INFLIGHT_NO_HOTEL_TEXT)
    expect(registerScheduleHotelTextFromFactHotels(['기내박', '힐튼 호텔'])).toBe('힐튼 호텔')
    expect(registerScheduleHotelTextFromFactHotels([])).toBeNull()
    expect(normalizeRegisterScheduleDayHotelText('기내박')).toBe(REGISTER_SCHEDULE_INFLIGHT_NO_HOTEL_TEXT)
    expect(normalizeRegisterScheduleDayHotelText('기내박 후 힐튼 호텔 투숙')).toBe('기내박 후 힐튼 호텔 투숙')
  })
})

describe('3) 국가 오추론 — 단어 경계 + 목적지 권역', () => {
  it('단어 안에 박힌 지명(볼거리가→리가, 스페인광장)은 나라 증거가 아니다', () => {
    const ctx = { productTitle: '괌 자유여행 5일', productDestination: '괌' }
    expect(strongOtherCountryKeysFromHay('다양한 볼거리가 있는 시내 관광', null, ctx)).not.toContain('latvia')
    expect(strongOtherCountryKeysFromHay('투몬 해변 - 스페인광장 - 사랑의 절벽', null, ctx)).not.toContain('spain')
  })
  it('목적지 권역에 안 맞는 단일 지명 토큰 추론은 버린다 (룩소 서안 ≠ 중국)', () => {
    const ctx = { productTitle: '이집트 일주 10일', productDestination: '이집트' }
    expect(registerProductDestinationCountryKeys(ctx)).toContain('egypt')
    expect(strongOtherCountryKeysFromHay('룩소 서안 - 왕가의 계곡 - 멤논의 거상', null, ctx)).not.toContain('china')
  })
  it('목적지와 같은 권역이면 유지, 국가명 직접 언급은 유지', () => {
    expect(countryKeyFitsProductDestination('china', ['japan'])).toBe(true)
    expect(countryKeyFitsProductDestination('china', ['egypt'])).toBe(false)
    const ctx = { productTitle: '이집트 일주 10일', productDestination: '이집트' }
    expect(strongOtherCountryKeysFromHay('스페인 마드리드 경유', null, ctx)).toContain('spain')
  })
})

describe('4) 일차 요약·이미지 키워드', () => {
  it('영문 도시명 → 한글', () => {
    expect(koreanPlaceNameFromEnglish('Lucerne')).toBe('루체른')
    expect(koreanPlaceNameFromEnglish('Cairo')).toBe('카이로')
    expect(koreanizeRegisterSchedulePlaceNames('인천에서 출발해 Cebu에 도착합니다.')).toBe('인천에서 출발해 세부에 도착합니다.')
    expect(koreanizeRegisterSchedulePlaceNames('숙소는 HOTEL REBSTOCK입니다.')).toBe('숙소는 HOTEL REBSTOCK입니다.')
  })

  it('filler 문장 판정', () => {
    expect(isRegisterScheduleFillerSentence('첫날 리듬을 맞추며 일정을 이어갑니다.')).toBe(true)
    expect(isRegisterScheduleFillerSentence('파리에서 주변을 이어서 둘러봅니다.')).toBe(true)
    expect(isRegisterScheduleFillerSentence('여정을 정리하고 귀국하는 마무리 일정입니다.')).toBe(true)
    expect(isRegisterScheduleFillerSentence('베르사유 궁전과 샹제리제 거리를 둘러봅니다.')).toBe(false)
  })

  it('3~4문장, filler 없음, 한글 지명, 없는 사실은 지어내지 않음', () => {
    const d = finalizeRegisterScheduleDaySummary(
      {
        day: 2,
        title: '베르사유 궁전 · 파리',
        routeText: '베르사유 궁전(내부) - 샹제리제 거리 - 개선문 - 콩코드 광장 - 파리',
        description: '베르사유 궁전과 샹제리제 거리를 둘러봅니다. 파리에서 주변을 이어서 둘러봅니다.',
        hotelText: 'HOTEL A // ADD : 1 rue X // TEL : +33 1',
        breakfastText: '호텔식',
        lunchText: '현지식',
        dinnerText: null,
      },
      { maxDay: 5 },
    )
    const ss = splitRegisterScheduleDescriptionSentences(d)
    expect(ss.length).toBeGreaterThanOrEqual(3)
    expect(ss.length).toBeLessThanOrEqual(4)
    expect(d).not.toMatch(/주변을 이어서 둘러봅니다/)
    expect(d).toContain('개선문')
    expect(d).toContain('숙소는 HOTEL A입니다.')
  })

  it('첫날 영문 도착지 합성문 → 한글·조사 교정, 상품명 route 문장은 버림', () => {
    const a = finalizeRegisterScheduleDaySummary(
      { day: 1, routeText: 'Lucerne', description: '인천에서 출발해 Lucerne에서 도착합니다. 첫날 리듬을 맞추며 일정을 이어갑니다.' },
      { maxDay: 10 },
    )
    expect(a).toBe('인천에서 출발해 루체른에 도착합니다.')
    const b = finalizeRegisterScheduleDaySummary(
      {
        day: 1,
        routeText: '★대기예약★『와라!보라!』아이슬란드 일주 8일',
        description: '인천에서 출발해 ★대기예약★『와라!보라!』아이슬란드 일주 8일에서 도착합니다.',
        hotelText: '기내박',
      },
      { maxDay: 8 },
    )
    expect(b).not.toMatch(/★|『/)
    expect(b).toContain('기내에서 1박')
  })

  it('이미지 키워드 — 다른 날 장소는 그날 장소로 교체', () => {
    const rows = finalizeRegisterPackageScheduleRows([
      { day: 1, title: '파리', routeText: '인천 - 파리', description: '', imageKeyword: 'Paris', imageKeyword2: null },
      {
        day: 2,
        title: '베르사유 궁전 · 파리',
        routeText: '베르사유 궁전 - 파리',
        description: '',
        imageKeyword: 'Colosseum Rome',
        imageKeyword2: null,
      },
      { day: 3, title: '로마', routeText: '로마 - 콜로세움', description: '', imageKeyword: 'Colosseum Rome', imageKeyword2: null },
      { day: 4, title: '귀국', routeText: '로마 - 인천', description: '', imageKeyword: 'Rome', imageKeyword2: null },
    ])
    expect(rows[1]!.imageKeyword).not.toMatch(/Colosseum/)
    expect(rows[1]!.imageKeyword).toMatch(/Versailles|Paris/)
    expect(rows[2]!.imageKeyword).toBe('Colosseum Rome')
  })

  it('키워드의 타국 도시 수식어는 상품 텍스트에 없으면 뗀다', () => {
    expect(stripForeignCityQualifierFromKeyword('Kota Kinabalu island hopping', '세부 아일랜드 호핑')).toBe('island hopping')
    expect(stripForeignCityQualifierFromKeyword('Blue Lagoon Vang Vieng', '레이캬비크 블루라군')).toBe('Blue Lagoon')
    expect(stripForeignCityQualifierFromKeyword('Blue Lagoon Vang Vieng', '방비엥 블루라군')).toBe('Blue Lagoon Vang Vieng')
    expect(restrictRegisterScheduleImageKeywordsToSameDay([{ day: 1, routeText: '', imageKeyword: '' }])[0]!.imageKeyword).toBe('')
  })
})

describe('4b) 요약 — 불포함 식사·이름 없는 예정 호텔·자리표시 제목', () => {
  it('불포함/유료 식사는 쓰지 않고, 이름 없는 예정 호텔 문장은 만들지 않는다', () => {
    const d = finalizeRegisterScheduleDaySummary(
      {
        day: 2,
        routeText: '마나도 - 부나켄 해양공원',
        description: '',
        hotelText: '예정 호텔 또는 동급',
        breakfastText: '호텔식',
        lunchText: '불포함',
        dinnerText: '자유식(불포함)',
      },
      { maxDay: 5 },
    )
    expect(d).not.toMatch(/불포함|예정 호텔/)
    expect(d).toContain('조식 호텔식')
  })
  it('N일차 제목은 그날 route 의 한글 장소로 채운다', () => {
    const rows = finalizeRegisterPackageScheduleRows([
      { day: 1, title: '1일차', routeText: 'Cebu', description: '', imageKeyword: 'Cebu' },
      { day: 2, title: '세부 · 호핑', routeText: '세부 - 아일랜드 호핑', description: '', imageKeyword: '' },
      { day: 3, title: '귀국', routeText: '세부', description: '', imageKeyword: '' },
    ])
    expect(rows[0]!.title).toBe('세부')
    expect(rows[0]!.routeText).toBe('세부')
  })
})

import { adjacentDayVisitCityForEdgeRoute } from '@/lib/register-pre-photo-self-heal'

describe('round2-1031 edge route restore prefers adjacent-day city over title hashtag city', () => {
  const days = [
    { day: 1, routeText: '' },
    { day: 2, routeText: '베르사유 궁전(내부) - 샹제리제 거리 - 파리' },
    { day: 3, routeText: '로마 시내 - 로마 출발' },
    { day: 4, routeText: '' },
  ]
  it('departure day takes the first city segment of day 2', () => {
    expect(adjacentDayVisitCityForEdgeRoute(days, 1, 4)).toBe('파리')
  })
  it('return day takes the last city segment of the previous day', () => {
    expect(adjacentDayVisitCityForEdgeRoute(days, 4, 4)).toBe('로마')
  })
  it('returns null when the neighbour has no city (falls back to destination)', () => {
    expect(adjacentDayVisitCityForEdgeRoute([{ day: 1, routeText: '' }, { day: 2, routeText: '자유시간' }], 1, 2)).toBeNull()
  })
})
