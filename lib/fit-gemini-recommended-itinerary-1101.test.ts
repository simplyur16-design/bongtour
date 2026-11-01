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
import { registerScheduleDayIsCityOnlyPhotoSkip } from '@/lib/register-schedule-city-only-day'
import { buildAirtelPrompt } from '@/lib/fit-itinerary-generate-for-product'
import type { FitItineraryGeminiResponse } from '@/lib/fit-itinerary-gemini-parse'

const day = (n: number, summary = '첫날은 짐만 풀고 시장 골목으로 나가 보세요. 해가 지면 간판 불이 들어와 걷기 좋아요. 저녁은 시장 안 노점에서 가볍게 드시면 편해요.') => ({
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
