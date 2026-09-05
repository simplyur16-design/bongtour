/**
 * REGRESSION-FREEZE[pexels-normalize-da-nang-not-da]: 2030 다낭 imageKeyword ≠ Da — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import {
  isLikelyTourismLandmarkKeyword,
  isNonLandmarkFoodOrDiningImageKeyword,
  isNonLandmarkSpaShoppingLoungeImageKeyword,
  isBareCityOrCountryKeyword,
  isScheduleImageKeywordLandmarkEligible,
  isWeakOpaqueImageKeyword,
} from '@/lib/pexels-place-name-keyword'
import { applyHanatourAirtelFreeTravelImageKeywordsToScheduleIfNeeded } from '@/lib/parse-and-register-hanatour-schedule'

describe('isNonLandmarkFoodOrDiningImageKeyword', () => {
  it('식당·카페·라멘 거리 차단', () => {
    expect(isNonLandmarkFoodOrDiningImageKeyword('Melbourne laneway cafes city day')).toBe(true)
    expect(isNonLandmarkFoodOrDiningImageKeyword('Fukuoka city ramen street night')).toBe(true)
    expect(isNonLandmarkFoodOrDiningImageKeyword('Sydney harbour restaurant view')).toBe(true)
    expect(isNonLandmarkFoodOrDiningImageKeyword('local cafe district')).toBe(true)
  })

  it('랜드마크는 통과', () => {
    expect(isNonLandmarkFoodOrDiningImageKeyword('Sydney Opera House')).toBe(false)
    expect(isNonLandmarkFoodOrDiningImageKeyword('Bondi Beach')).toBe(false)
    expect(isLikelyTourismLandmarkKeyword('Blue Mountains')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('Taj Mahal')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('Hungarian Parliament Budapest')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('La Rambla Barcelona')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('Forbidden City')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('Great Wall of China')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('Golden Circle Iceland')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('Petra Treasury')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('Wadi Rum desert')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('Stonehenge Salisbury Plain')).toBe(true)
    // REGRESSION-FREEZE[schedule-kolsai-lakes-landmark-hint]: Lakes plural is landmark — manifest
    expect(isLikelyTourismLandmarkKeyword('Kolsai Lakes')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('Kolsai Lakes Kazakhstan')).toBe(true)
    expect(isLikelyTourismLandmarkKeyword('Kaindy Lake')).toBe(true)
    expect(isScheduleImageKeywordLandmarkEligible('Taj Mahal')).toBe(true)
    expect(isScheduleImageKeywordLandmarkEligible('La Rambla Barcelona')).toBe(true)
    expect(isScheduleImageKeywordLandmarkEligible('Forbidden City')).toBe(true)
  })
})

describe('applyHanatourScheduleImageKeywordsToRows — 랜드마크 우선', () => {
  const sydneyOpts = { productDestination: 'Australia Sydney' }

  it('LLM이 카페 키워드여도 본문 명소(본다이)로 교정', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        { day: 1, title: '출발', description: '인천 출발', routeText: '인천 - 시드니', imageKeyword: '', imageKeyword2: null },
        {
          day: 3,
          title: '본다이 비치',
          description: '공항 픽업 후 본다이 비치 자유 관광',
          routeText: '시드니 - 본다이 비치',
          imageKeyword: 'Sydney cafe brunch district',
          imageKeyword2: null,
        },
        { day: 4, title: '귀국', description: '인천 도착', routeText: '시드니 - 인천', imageKeyword: '', imageKeyword2: null },
      ],
      sydneyOpts,
    )
    const d3 = out.find((r) => r.day === 3)!
    expect(d3.imageKeyword).toBe('Bondi Beach')
    expect(d3.imageKeyword).not.toMatch(/cafe|brunch|restaurant/i)
    expect(isScheduleImageKeywordLandmarkEligible(d3.imageKeyword!)).toBe(true)
  })

  it('LLM이 블루마운틴 대신 식당 키워드면 본문 명소 사용', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        { day: 1, title: '출발', description: '인천 출발', routeText: '인천 - 시드니', imageKeyword: '', imageKeyword2: null },
        {
          day: 4,
          title: '블루마운틴',
          description: '블루마운틴 당일투어 (선택)',
          routeText: '시드니 - 블루마운틴',
          imageKeyword: 'Blue Mountains restaurant lunch',
          imageKeyword2: null,
        },
        { day: 5, title: '귀국', description: '인천 도착', routeText: '시드니 - 인천', imageKeyword: '', imageKeyword2: null },
      ],
      sydneyOpts,
    )
    const d4 = out.find((r) => r.day === 4)!
    expect(d4.imageKeyword).toBe('Blue Mountains')
  })
})

describe('푸꾸옥 자유여행 — 스파·식당·불투명 단어 거부', () => {
  const phuQuocOpts = { productDestination: '베트남 푸꾸옥' }

  it('Day1 Restaurant / Day4 Moon Spa / Day2 Khem → 랜드마크·도시로 교정', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '푸꾸옥 도착',
          description: '인천 출발 후 푸꾸옥 도착',
          routeText: '인천 - 푸꾸옥',
          imageKeyword: 'New World Resort Restaurant',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '에메랄드빛 바다',
          description: '푸꾸옥 자유일정',
          routeText: '푸꾸옥',
          imageKeyword: 'Khem',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '역사와 자연',
          description: '스타피쉬 비치와 호국사',
          routeText: '스타피쉬 비치 - 호국사 - 사오 비치 - 킹콩마트',
          imageKeyword: 'Ho Quoc Pagoda',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '힐링',
          description: '문 스파 후 귀국',
          routeText: '푸꾸옥 - T라운지 - 문 스파 - 푸꾸옥 국제공항',
          imageKeyword: 'Moon Spa',
          imageKeyword2: null,
        },
      ],
      phuQuocOpts,
    )

    // 출발일은 방문 도시(Phu Quoc) 폴백 허용 — 식당 키워드는 제거
    expect(String(out[0]!.imageKeyword ?? '')).toMatch(/Phu Quoc/i)
    expect(out[0]!.imageKeyword).not.toMatch(/restaurant/i)
    expect(isBareCityOrCountryKeyword(out[0]!.imageKeyword!) || isScheduleImageKeywordLandmarkEligible(out[0]!.imageKeyword!)).toBe(true)
    expect(isWeakOpaqueImageKeyword('Khem')).toBe(true)
    expect(out[1]!.imageKeyword).not.toBe('Khem')
    expect(out[2]!.imageKeyword).toMatch(/Ho Quoc|Starfish|Sao Beach/i)
    expect(isNonLandmarkSpaShoppingLoungeImageKeyword(out[3]!.imageKeyword!)).toBe(false)
    expect(out[3]!.imageKeyword).not.toMatch(/spa|lounge/i)
  })
})

describe('applyHanatourAirtelFreeTravelImageKeywordsToScheduleIfNeeded — 에어텔 폴백', () => {
  const meta = {
    productType: 'air-hotel' as const,
    title: '호주 시드니 자유여행 6일',
    destinationRaw: '호주',
    primaryDestination: '시드니',
    destination: '호주,시드니',
    pastedSnippet: '시드니 오페라하우스',
  }

  it('멜번·후쿠오카 폴백에 식당·카페 문구 없음', () => {
    const mel = applyHanatourAirtelFreeTravelImageKeywordsToScheduleIfNeeded(
      [{ day: 1, title: '', description: '', imageKeyword: '' }],
      { ...meta, title: '멜번 자유여행', primaryDestination: '멜번' },
    )
    expect(mel[0]!.imageKeyword).not.toMatch(/cafe|restaurant|ramen/i)

    const fuku = applyHanatourAirtelFreeTravelImageKeywordsToScheduleIfNeeded(
      [{ day: 1, title: '', description: '', imageKeyword: '' }],
      { ...meta, title: '후쿠오카 자유여행', primaryDestination: '후쿠오카' },
    )
    expect(fuku[0]!.imageKeyword).not.toMatch(/cafe|restaurant|ramen/i)
  })

  it('시드니는 오페라하우스·하버 랜드마크', () => {
    const out = applyHanatourAirtelFreeTravelImageKeywordsToScheduleIfNeeded(
      [{ day: 1, title: '', description: '', imageKeyword: '' }],
      meta,
    )
    expect(out[0]!.imageKeyword).toMatch(/Opera House|harbour/i)
    expect(isNonLandmarkFoodOrDiningImageKeyword(out[0]!.imageKeyword!)).toBe(false)
  })
})

describe('hanatour 2030 다낭 imageKeyword', () => {
  it('다낭 일정은 Da 조각이 아니라 Da Nang·명소', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        { day: 1, title: '다낭 도착', routeText: '인천 - 다낭', imageKeyword: '', imageKeyword2: null },
        {
          day: 2,
          title: '다낭 시내',
          routeText: '다낭 대성당 - 미케비치 - 용다리',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 3, title: '호이안', routeText: '호이안 옛도시', imageKeyword: '', imageKeyword2: null },
        { day: 4, title: '귀국', routeText: '다낭 - 인천', imageKeyword: '', imageKeyword2: null },
      ],
      { productDestination: '다낭' },
    )
    const joined = out
      .flatMap((r) => [r.imageKeyword, r.imageKeyword2])
      .map((k) => String(k ?? '').trim())
      .filter(Boolean)
    expect(joined.some((k) => /^Da$/i.test(k))).toBe(false)
    expect(joined.join(' ')).toMatch(/Da Nang|My Khe|Dragon Bridge|Hoi An|Cathedral/i)
  })

  it('에어텔 다낭 폴백도 Da Nang', () => {
    const out = applyHanatourAirtelFreeTravelImageKeywordsToScheduleIfNeeded(
      [{ day: 1, title: '', description: '', imageKeyword: '' }],
      {
        productType: 'air-hotel',
        title: '[2030전용] 다낭/호이안 4일',
        destinationRaw: '다낭',
        primaryDestination: '다낭',
        destination: '베트남,다낭',
        pastedSnippet: '다낭',
      },
    )
    expect(out[0]!.imageKeyword).toBe('Da Nang')
  })
})

describe('hanatour 2030 다낭 — 작은 산토리니 ≠ 그리스', () => {
  it('다낭 별칭 산토리니는 Santorini/Fira/Oia 금지', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, title: '다낭 입국', routeText: '다낭 입국', imageKeyword: '', imageKeyword2: null },
        {
          day: 2,
          title: '손짜 마리나 카페 · 다낭에서 만나는 작은 산토리니',
          routeText: '손짜 마리나 카페 - 다낭에서 만나는 작은 산토리니 - 한시장 - 대성당',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '선셋 패들보드',
          routeText: '선셋 패들보드 - 패들보드 일출 - 루프탑 바 - BELLE MAISON PAROSAND DANANG HOTEL',
          imageKeyword: '',
          imageKeyword2: null,
        },
        { day: 4, title: '콩 카페', routeText: '콩 카페 - 롯데마트', imageKeyword: '', imageKeyword2: null },
        { day: 5, title: '귀국', routeText: '다낭 출발 및 인천 귀국', imageKeyword: '', imageKeyword2: null },
      ],
      { supplierKey: 'hanatour', productDestination: '다낭 (한시장)', productTitle: '[2030전용] 다낭 5일' },
    )
    const joined = out.map((r) => `${r.imageKeyword} ${r.imageKeyword2}`).join(' ')
    expect(joined).not.toMatch(/Santorini|Fira|Oia|Caldera/i)
    expect(joined).not.toMatch(/BELLE MAISON|PAROSAND/i)
    expect(joined).toMatch(/Da Nang|Han Market|Cathedral|Linh Ung|Son Tra/i)
  })
})
