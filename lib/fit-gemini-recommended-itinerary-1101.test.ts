import { describe, expect, it } from 'vitest'
import { parseTripDaysFromDurationText, resolveFitTotalDays } from '@/lib/fit-itinerary-total-days'
import {
  ITINERARY_GENERATION_MAX_ATTEMPTS,
  itineraryGenerationAttemptsExhausted,
  mergeItineraryGenerationStatusIntoRawMeta,
  readItineraryGenerationStatus,
} from '@/lib/fit-itinerary-generation-status'
import { kstTomorrowStartUtc } from '@/lib/product-future-departure'
import { validateFitItineraryGeminiDays } from '@/lib/fit-itinerary-validate-days'
import { registerPublishBlockReasons } from '@/lib/register-auto-register-gate'
import { mergeScheduleWithFitKeywords } from '@/lib/fit-itinerary-merge-schedule-keywords'
import { pickFitDayImageKeywordDistinct, collectFitDayEnglishPlaceNames } from '@/lib/fit-itinerary-pick-day-image-keyword'
import { registerFitKeywordFromOwnDayPlaces } from '@/lib/register-pre-photo-guards'
import { buildProductScheduleJsonForDb } from '@/lib/schedule-image-keyword-persist'
import { scheduleRowsForPrePhotoVerify } from '@/lib/register-pre-photo-verify'
import { registerScheduleDayIsCityOnlyPhotoSkip } from '@/lib/register-schedule-city-only-day'
import { buildAirtelPrompt } from '@/lib/fit-itinerary-generate-for-product'
import type { FitItineraryGeminiResponse } from '@/lib/fit-itinerary-gemini-parse'

const day = (n: number, summary = '첫날은 짐만 풀고 구로몬 시장 골목으로 나가 보세요. 해가 지면 간판 불이 들어와 걷기 좋아요. 저녁은 시장 안 노점에서 가볍게 드시면 편해요.') => ({
  dayNumber: n,
  title: `시장 골목 ${'산책'}`,
  summary,
  dayCityKey: 'osaka',
  activities: [
    { order: 1, category: 'attraction' as const, title: '구로몬 시장', description: '골목 구경', location: '구로몬 시장 (Kuromon Market)', startTime: null, durationMinutes: null, estimatedCostKrw: null, estimatedCostNote: null, transportMode: null, transportDuration: null },
  ],
})
const resp = (n: number): FitItineraryGeminiResponse => ({
  title: '오사카 자유여행',
  summary: '요약',
  persona: 'mixed',
  days: Array.from({ length: n }, (_, i) => day(i + 1)),
}) as never

describe('fit gemini recommended itinerary 1101 — 일수', () => {
  it('duration 텍스트에서 일수', () => {
    expect(parseTripDaysFromDurationText('2박 3일')).toBe(3)
    expect(parseTripDaysFromDurationText('3박')).toBe(4)
    expect(parseTripDaysFromDurationText('')).toBeNull()
  })
  it('기본값 4일 없음 — 원문 행 수·schedule 로만, 없으면 null', () => {
    expect(resolveFitTotalDays({ duration: '', itineraryDayCount: 9 })).toEqual({ days: 9, source: 'itinerary_days' })
    expect(resolveFitTotalDays({ duration: '', itineraryDayCount: 0, schedule: JSON.stringify([{ day: 1 }, { day: 10 }]) })?.days).toBe(10)
    expect(resolveFitTotalDays({ duration: null, itineraryDayCount: 0, schedule: null })).toBeNull()
    expect(resolveFitTotalDays({ duration: '4박 5일', itineraryDayCount: 3 })?.days).toBe(5)
  })
})

describe('실패 사유 rawMeta 기록', () => {
  it('다른 키는 두고 상태만 합친다, 횟수 증가', () => {
    const a = mergeItineraryGenerationStatusIntoRawMeta(JSON.stringify({ prePhoto: { x: 1 } }), { ok: false, reason: 'gemini_failed', detail: 'timeout' })!
    expect(JSON.parse(a).prePhoto).toEqual({ x: 1 })
    expect(readItineraryGenerationStatus(a)?.reason).toBe('gemini_failed')
    const b = mergeItineraryGenerationStatusIntoRawMeta(a, { ok: false, reason: 'validation_failed' })!
    expect(readItineraryGenerationStatus(b)?.attempts).toBe(2)
  })
  it('JSON 아닌 rawMeta 는 바꾸지 않음', () => {
    expect(mergeItineraryGenerationStatusIntoRawMeta('not json', { ok: true })).toBeNull()
  })
  it('상한 넘으면 백필 제외', () => {
    let m: string | null = null
    for (let i = 0; i < ITINERARY_GENERATION_MAX_ATTEMPTS; i++) m = mergeItineraryGenerationStatusIntoRawMeta(m, { ok: false, reason: 'x' })
    expect(itineraryGenerationAttemptsExhausted(m)).toBe(true)
    expect(itineraryGenerationAttemptsExhausted(null)).toBe(false)
  })
})

describe('향후 출발일', () => {
  it('오늘 이후 = 한국 날짜 내일 00:00', () => {
    // 2026-11-01 19:00 KST
    const now = new Date('2026-11-01T10:00:00Z')
    expect(kstTomorrowStartUtc(now).toISOString()).toBe('2026-11-01T15:00:00.000Z')
    // 2026-11-01 02:00 KST (UTC 는 아직 10/31)
    expect(kstTomorrowStartUtc(new Date('2026-10-31T17:00:00Z')).toISOString()).toBe('2026-11-01T15:00:00.000Z')
  })
  it('공개 게이트 — 향후 출발일 없음·자유여행 추천일정 부족', () => {
    expect(registerPublishBlockReasons({ futureDepartureCount: 0 })).toEqual(['no_future_departures'])
    expect(registerPublishBlockReasons({ futureDepartureCount: 3, fitItinerary: { masterDays: 0, requiredDays: 3 } })).toEqual(['fit_itinerary_missing'])
    expect(registerPublishBlockReasons({ futureDepartureCount: 3, fitItinerary: { masterDays: 4, requiredDays: 10 } })).toEqual(['fit_itinerary_missing'])
    expect(registerPublishBlockReasons({ futureDepartureCount: 3, fitItinerary: { masterDays: 3, requiredDays: 3 } })).toEqual([])
  })
})

describe('추천일정 검사', () => {
  it('일수 맞고 빈 날 없으면 통과', () => {
    expect(validateFitItineraryGeminiDays(resp(3), 3).ok).toBe(true)
  })
  it('일수 틀리면 실패', () => {
    const v = validateFitItineraryGeminiDays(resp(4), 10)
    expect(v.ok).toBe(false)
    expect(v.issues.some((i) => i.startsWith('days_count_4'))).toBe(true)
    expect(v.issues).toContain('day5_missing')
  })
  it('빈 요약·가격·최저가 실패', () => {
    const r = resp(2)
    r.days[1] = day(2, '') as never
    expect(validateFitItineraryGeminiDays(r, 2).issues).toContain('day2_summary_empty')
    const r2 = resp(1)
    r2.days[0] = day(1, '시장 골목은 최저가로 즐기기 좋아요. 해가 지면 간판 불이 들어와 걷기 좋아요. 저녁은 노점에서 드세요.') as never
    expect(validateFitItineraryGeminiDays(r2, 1).issues).toContain('day1_banned_word')
  })
  it('장소 이름 속 숫자(2세 갤러리아)는 숫자 금지에 걸리지 않는다', () => {
    const r = resp(1)
    r.days[0] = {
      ...day(1, '비토리오 에마누엘레 2세 갤러리아는 유리 천장으로 햇살이 들어와 예뻐요. 천천히 걸으며 구경하시면 좋아요. 근처 골목도 가볍게 둘러보세요.'),
      activities: [{ ...day(1).activities[0], title: '비토리오 에마누엘레 2세 갤러리아', location: '비토리오 에마누엘레 2세 갤러리아 (Galleria Vittorio Emanuele II)' }],
    } as never
    expect(validateFitItineraryGeminiDays(r, 1).issues).not.toContain('day1_number')
    r.days[0] = { ...(r.days[0] as object), summary: '비토리오 에마누엘레 2세 갤러리아까지 30분이면 가요. 천천히 걸으며 구경하시면 좋아요. 근처 골목도 가볍게 둘러보세요.' } as never
    expect(validateFitItineraryGeminiDays(r, 1).issues).toContain('day1_number')
  })
  it('그날 동선 장소 이름이 요약에 없으면 실패(등록 전 검사와 같은 기준)', () => {
    const r = resp(1)
    r.days[0] = day(1, '기차를 타고 호수 마을로 떠나 맑은 공기를 마셔 보세요. 산책로를 따라 걷는 시간이 참 평화로워요. 호수가 보이는 식당에서 점심을 드시면 돼요.') as never
    expect(validateFitItineraryGeminiDays(r, 1).issues).toContain('day1_summary_no_route_place')
  })
  it("'Duomo Di'처럼 전치사로 끝난 키워드는 쓰지 않는다", () => {
    const kw = pickFitDayImageKeywordDistinct(
      {
        dayNumber: 2,
        title: '대성당',
        summary: '밀라노 대성당과 갤러리아를 걸어요.',
        activities: [
          { order: 1, category: 'attraction', title: '밀라노 대성당', description: '', location: '밀라노 대성당 (Duomo di Milano)' },
          { order: 2, category: 'attraction', title: '갤러리아', description: '', location: '비토리오 에마누엘레 2세 갤러리아 (Galleria Vittorio Emanuele II)' },
        ],
      },
      { cityNameKo: '밀라노', cityKey: 'milan', productTitle: '밀라노 9일', primaryDestination: '밀라노', destination: '밀라노' },
      new Set(),
    )
    expect(kw).not.toMatch(/\sDi$/i)
    expect(kw.length).toBeGreaterThan(0)
  })
})

describe('자유여행 일정 = 추천일정 일차만', () => {
  it('원문 꼬리·유령 일차 제거, 동선·문장은 추천일정에서', () => {
    const existing = [1, 2, 3, 4].map((d) => ({ day: d, title: `원문 ${d}`, description: '원문', routeText: '원문', imageKeyword: '', imageUrl: null, imageUrl2: null }))
    const fitDays = resp(3).days.map((d) => ({ ...d, summary: d.summary }))
    const { rows } = mergeScheduleWithFitKeywords(existing as never, fitDays as never, { cityNameKo: '오사카', cityKey: 'osaka', productTitle: '오사카' } as never)
    expect(rows.map((r) => r.day)).toEqual([1, 2, 3])
    expect(rows.every((r) => String(r.description).includes('시장'))).toBe(true)
    expect(rows.every((r) => String(r.routeText ?? '').length > 0 && r.routeText !== '원문')).toBe(true)
  })
})

describe('자유일정 날은 도시만 규칙 제외', () => {
  it('추천일정·자유일정 제목이면 사진 비우지 않음', () => {
    expect(registerScheduleDayIsCityOnlyPhotoSkip({ title: '하노이 자유일정', routeText: '하노이' })).toBe(false)
    expect(registerScheduleDayIsCityOnlyPhotoSkip({ title: '이동', routeText: '하노이' })).toBe(true)
  })
})

describe('프롬프트', () => {
  it('봉실장 목소리·공급사 일정표 안 씀·전 일차', () => {
    const p = buildAirtelPrompt({ title: 't', cityNameKo: '오사카', cityKey: 'osaka', countryCode: 'JP', duration: '9일', totalDays: 9, airline: null, hotelSummaryText: null, airtelHotelInfoJson: null, schedule: 'SUPPLIER_SECRET_ROW' })
    expect(p).toContain('봉실장')
    expect(p).not.toContain('SUPPLIER_SECRET_ROW')
    expect(p).toContain('1일차부터 9일차까지')
    expect(p).toContain('최저가')
  })
})

describe('fit gemini 1101 — 추천일정 장소 키워드 출처', () => {
  it('그날 장소 영문 이름을 모으고(식사·이동 제외) 키워드 출처로 인정한다', () => {
    const names = collectFitDayEnglishPlaceNames({
      dayNumber: 2,
      title: 't',
      summary: 's',
      activities: [
        { order: 1, category: 'attraction', title: '긴자', description: '', location: '긴자 (Ginza)' },
        { order: 2, category: 'meal', title: '초밥집', description: '', location: '초밥집 (Sushi Bar)' },
        { order: 3, category: 'transport', title: '공항', description: '', location: '나리타 국제공항 (Narita Airport)' },
      ],
    })
    expect(names).toEqual(['Ginza'])
    expect(registerFitKeywordFromOwnDayPlaces({ fitPlaceKeywordsEn: names }, 'Ginza')).toBe(true)
    expect(registerFitKeywordFromOwnDayPlaces({ fitPlaceKeywordsEn: names }, 'Shibuya')).toBe(false)
    expect(registerFitKeywordFromOwnDayPlaces({}, 'Ginza')).toBe(false)
  })
  it('schedule JSON 저장·검사 읽기에서 장소 영문 이름이 유지된다', () => {
    const json = buildProductScheduleJsonForDb([
      { day: 1, title: '긴자', description: '긴자 거리를 걸어요.', routeText: '긴자', imageKeyword: 'Ginza', imageKeyword2: null, imageUrl: null, imageUrl2: null, fitPlaceKeywordsEn: ['Ginza'] } as never,
    ])
    expect(JSON.parse(json)[0].fitPlaceKeywordsEn).toEqual(['Ginza'])
    expect(scheduleRowsForPrePhotoVerify(json)[0].fitPlaceKeywordsEn).toEqual(['Ginza'])
  })
})

describe('fit gemini 1101 — 관광지 없는 날 키워드 폴백', () => {
  it("cityKey 'it' 대신 앞선 날 추천일정 장소를 쓴다", () => {
    const { rows } = mergeScheduleWithFitKeywords(
      [],
      [
        {
          dayNumber: 1,
          title: '두오모',
          summary: '밀라노 두오모와 꼬모 호수를 둘러봐요.',
          activities: [
            { order: 1, category: 'attraction', title: '밀라노 두오모', description: '', location: '밀라노 두오모 (Duomo di Milano)' },
            { order: 2, category: 'attraction', title: '꼬모 호수', description: '', location: '꼬모 호수 (Lake Como)' },
          ],
        },
        {
          dayNumber: 2,
          title: '인천 도착',
          summary: '인천 국제공항에 도착해요.',
          activities: [{ order: 1, category: 'transport', title: '인천 국제공항 도착', description: '', location: '인천 국제공항' }],
        },
      ],
      { cityNameKo: '밀라노', cityKey: 'it', productTitle: '[에어텔전용] 이탈리아 9일', primaryDestination: '밀라노', destination: '밀라노' },
    )
    expect(rows[1]!.imageKeyword).not.toBe('It')
    expect(rows[0]!.imageKeyword).toBe('Lake Como')
    expect(rows[1]!.imageKeyword).toBe('Lake Como')
  })
})

describe('fit gemini 1101 — 그날 장소 키워드 유지', () => {
  it('그날 관광지(공원)가 있으면 다른 날 장소로 바꾸지 않는다', () => {
    const { rows } = mergeScheduleWithFitKeywords(
      [],
      [
        { dayNumber: 1, title: '꼬모', summary: '꼬모 호수를 둘러봐요.', activities: [{ order: 1, category: 'attraction', title: '꼬모 호수', description: '', location: '꼬모 호수 (Lake Como)' }] },
        { dayNumber: 2, title: '공원', summary: '셈피오네 공원을 걸어요.', activities: [{ order: 1, category: 'attraction', title: '셈피오네 공원', description: '', location: '셈피오네 공원 (Parco Sempione)' }] },
      ],
      { cityNameKo: '밀라노', cityKey: 'it', productTitle: '[에어텔전용] 이탈리아 9일', primaryDestination: '밀라노', destination: '밀라노' },
    )
    expect(rows[1]!.imageKeyword).toBe('Parco Sempione')
  })
})
