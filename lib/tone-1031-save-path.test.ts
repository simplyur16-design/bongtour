/**
 * 톤 1031 저장 경로 증명 — 샘플 문장이 DB에 그대로 저장되는지(요약 2문장 자르기·템플릿 덮어쓰기 없음).
 * DB 없이 prisma 를 가짜로 바꿔 create 에 넘어간 값을 본다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import sampleA from '@/lib/__fixtures__/tone-1031-sample-A.json'
import sampleB from '@/lib/__fixtures__/tone-1031-sample-B-d3-regen2.json'

const created = { master: [] as any[], day: [] as any[], activity: [] as any[] }
const masterFindUnique = vi.fn()
const productFindUnique = vi.fn()
const syncMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    fitItineraryMaster: { findUnique: (...a: unknown[]) => masterFindUnique(...a) },
    product: { findUnique: (...a: unknown[]) => productFindUnique(...a) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        fitItineraryMaster: { create: async (x: { data: unknown }) => created.master.push(x.data) },
        fitItineraryDay: { create: async (x: { data: unknown }) => created.day.push(x.data) },
        fitItineraryActivity: { create: async (x: { data: unknown }) => created.activity.push(x.data) },
      }),
  },
}))
vi.mock('@/lib/fit-itinerary-sync-schedule-image-keywords', () => ({
  syncScheduleImageKeywordsFromFitItinerary: (...a: unknown[]) => syncMock(...a),
}))

import { persistFitItineraryFromGeminiJson, buildAirtelPrompt } from '@/lib/fit-itinerary-generate-for-product'
import { resolveFitDayCityKey } from '@/lib/fit-itinerary-day-city-key'
import { preserveFitDaySummary } from '@/lib/fit-itinerary-summary-two-sentences'
import { pickFitDayImageKeyword } from '@/lib/fit-itinerary-pick-day-image-keyword'
import {
  mergeGeminiFreeLeisureRecommendedItinerary,
  parseGeminiFreeLeisureRows,
  buildRegisterFreeDayRecommendedTitle,
  buildFreeLeisureDayGeminiPrompt,
} from '@/lib/register-schedule-image-keyword-gemini-fill'
import { hasRegisterFreeDayRecommendedItinerary } from '@/lib/register-pre-photo-verify'
import {
  finalizeRegisterPackageScheduleRows,
  type RegisterScheduleFinalizeRow,
} from '@/lib/register-schedule-day-summary-finalize'

const NEW_TITLE_RE = /^추천일정 1day · [^·]+·[^·]+$/

describe('톤 1031 A — persistFitItineraryFromGeminiJson 저장값 = 샘플 문장', () => {
  beforeEach(() => {
    created.master.length = 0
    created.day.length = 0
    created.activity.length = 0
    masterFindUnique.mockReset().mockResolvedValue(null)
    productFindUnique.mockReset().mockResolvedValue({
      id: 'fit-hn-0061',
      productType: 'airtel',
      listingKind: 'air_hotel_free',
      title: '오사카 4일 코코호텔 난바 에비스초',
      cityKey: 'osaka',
      primaryDestination: '오사카',
      destination: '오사카',
    })
    syncMock.mockReset().mockResolvedValue(undefined)
  })

  it('일차 summary 4개가 샘플 문장과 글자 하나까지 같고(3~4문장 유지), D2 교토 하루는 dayCityKey=kyoto', async () => {
    const r = await persistFitItineraryFromGeminiJson('fit-hn-0061', JSON.stringify(sampleA))
    expect(r.success).toBe(true)
    expect(created.day).toHaveLength(4)
    for (const src of sampleA.days) {
      const saved = created.day.find((d) => d.dayNumber === src.dayNumber)
      expect(saved?.summary).toBe(src.summary)
      expect(saved?.title).toBe(src.title)
      const sentences = String(saved?.summary).split(/(?<=[.!?요])\s+/u).filter(Boolean)
      expect(sentences.length).toBeGreaterThanOrEqual(3)
    }
    const byDay = Object.fromEntries(created.day.map((d) => [d.dayNumber, d.dayCityKey]))
    expect(byDay).toEqual({ 1: 'osaka', 2: 'kyoto', 3: 'osaka', 4: 'osaka' })
    // 시간·요금은 지어내지 않음 — null 그대로 저장
    expect(created.activity.every((a) => a.startTime == null && a.durationMinutes == null && a.estimatedCostKrw == null)).toBe(true)
    // 상품 제목(Product.title)은 건드리지 않음 — Product update 호출 없음, master.title 은 응답 title
    expect(created.master[0]?.title).toBe(sampleA.title)
    // 사진 키워드 동기화에 넘어가는 D2 dayCityKey 도 kyoto
    const syncDays = syncMock.mock.calls[0]?.[1] as Array<{ dayNumber: number; dayCityKey?: string }>
    expect(syncDays.find((d) => d.dayNumber === 2)?.dayCityKey).toBe('kyoto')
  })
})

describe('톤 1031 — 요약 보존·권역 표·사진 키워드', () => {
  it('preserveFitDaySummary: 3~4문장을 자르지 않고, 빈 값만 한 문장 채움', () => {
    const s = sampleA.days[1]!.summary
    expect(preserveFitDaySummary(s, { title: 'x', landmarkHint: '청수사' })).toBe(s)
    expect(preserveFitDaySummary('  ', { title: 'x', landmarkHint: '청수사' })).toMatch(/청수사/)
  })
  it('resolveFitDayCityKey: 장소 표가 모델 값보다 먼저, 기온≠region', () => {
    expect(resolveFitDayCityKey({ activities: sampleA.days[1]!.activities, productCityKey: 'osaka', modelDayCityKey: 'osaka' })).toBe('kyoto')
    expect(resolveFitDayCityKey({ activities: [{ category: 'attraction', location: '어딘가 (Kansai region)' }], productCityKey: 'osaka' })).toBe('osaka')
    expect(resolveFitDayCityKey({ activities: [], productCityKey: '', modelDayCityKey: 'nara' })).toBe('nara')
  })
  it('사진 키워드는 관광지에서 — 식당(meal) location 은 후보 아님', () => {
    const d3 = sampleA.days.find((d) => d.dayNumber === 3)!
    const kw = pickFitDayImageKeyword(d3 as any, { cityNameKo: '오사카', cityKey: 'osaka', productTitle: 't' })
    expect(kw).toMatch(/Universal Studios Japan/i)
    const mealOnly = {
      dayNumber: 9, title: '저녁', summary: '', dayCityKey: 'osaka',
      activities: [{ order: 1, category: 'meal', title: '식사', description: '', location: '이치란 라멘 (Ichiran Ramen)' }],
    }
    expect(pickFitDayImageKeyword(mealOnly as any, { cityNameKo: '오사카', cityKey: 'osaka', productTitle: 't' })).not.toMatch(/Ichiran/i)
    const koMeal = { ...mealOnly, activities: [{ order: 1, category: 'meal', title: '오코노미야키 저녁', description: '', location: '도톤보리 오코노미야키집' }] }
    expect(pickFitDayImageKeyword(koMeal as any, { cityNameKo: '오사카', cityKey: 'osaka', productTitle: 't' })).not.toMatch(/Dotonbori/i)
  })
  it('A 프롬프트: 3~4문장·금지어·숙소 규칙·숫자 null·상품 제목 그대로 쓰지 않기', () => {
    const p = buildAirtelPrompt({
      title: '오사카 4일', cityNameKo: '오사카', cityKey: 'osaka', countryCode: 'JP', duration: '3박 4일', totalDays: 4,
      airline: null, hotelSummaryText: null, airtelHotelInfoJson: null, schedule: null,
    })
    for (const w of ['3~4문장', '최저가', '무조건', '최고', '유명', '제일', '가장', '빠질 수 없는', '피로가 싹', '숙소 근처', '하루 한 권역', 'null']) {
      expect(p).toContain(w)
    }
    expect(p).toContain('상품 제목 문구를 일정 제목·요약에 그대로 옮겨 쓰지 않습니다')
    expect(p).not.toContain('정확히 2문장 한국어')
    expect(p).not.toContain('"HH:MM"')
  })
})

describe('톤 1031 B — 자유일정 날 저장값 = 제미나이 문장, 제목 새 형식 (mt-0240 D2 모양)', () => {
  const mt0240Rows = (): RegisterScheduleFinalizeRow[] =>
    [
      { day: 1, title: '오사카', routeText: '청주 - 간사이 공항 - 오사카', description: '', hotelText: 'H', imageKeyword: 'Osaka', imageKeyword2: null },
      { day: 2, title: '오사카 추천 1일 자유일정', routeText: '오사카 - 오사카 추천 1일 자유일정', description: '', hotelText: 'H', imageKeyword: '', imageKeyword2: null },
      { day: 3, title: '귀국', routeText: '간사이 공항 - 청주', description: '', hotelText: '', imageKeyword: '', imageKeyword2: null },
    ] as RegisterScheduleFinalizeRow[]
  const productTitle = '[청주출발] 오사카/교토/나라 3일 (1일자유)'
  const b = sampleB.schedule[0]!

  it.each([
    ['제미나이 제목에 장소가 붙은 경우(띄어쓰기 섞임)', b.title],
    ["제미나이가 '추천일정 1day'만 준 경우(round3 남은 문제)", '추천일정 1day'],
  ])('%s → 추천일정 1day · 장소·장소, 설명=요약 그대로, 추천일정 검사 통과, finalize 후에도 유지', (_label, geminiTitle) => {
    const byDay = parseGeminiFreeLeisureRows([{ ...b, day: 2, title: geminiTitle }])
    const merged = mergeGeminiFreeLeisureRecommendedItinerary(mt0240Rows(), byDay, { productTitle })
    const d2 = merged[1]!
    expect(d2.title).toMatch(NEW_TITLE_RE)
    expect(d2.title).not.toMatch(/오사카/)
    expect(d2.description).toBe(b.summary)
    expect(d2.description).not.toMatch(/둘러봅니다/)
    expect(hasRegisterFreeDayRecommendedItinerary(d2 as any)).toBe(true)
    const fin = finalizeRegisterPackageScheduleRows(merged as RegisterScheduleFinalizeRow[], { destination: '오사카' })
    expect(fin[1]!.title).toBe(d2.title)
    expect(fin[1]!.description).toContain(b.summary)
  })

  it('제목 만들기: 장소 붙은 제목은 가운데 점 띄어쓰기만 정리', () => {
    expect(buildRegisterFreeDayRecommendedTitle({ duration: '1day', geminiTitle: b.title, route: b.recommendedRoute, city: 'Osaka', productTitle })).toBe(
      '추천일정 1day · 나카자키초·우메다 스카이빌딩',
    )
    expect(buildRegisterFreeDayRecommendedTitle({ duration: '1day', geminiTitle: '추천일정 1day', route: '호젠지 요코초 - 도톤보리 - 아메리카무라', city: 'Osaka', productTitle })).toBe(
      '추천일정 1day · 호젠지 요코초·도톤보리',
    )
  })

  it('B 프롬프트: 3~4문장·금지어·숙소 위치 모름 규칙', () => {
    const p = buildFreeLeisureDayGeminiPrompt(mt0240Rows(), { productTitle, productDestination: '오사카', daysToFill: [2] })
    for (const w of ['3-4 sentences', '최저가', '무조건', '빠질 수 없는', '피로가 싹', '숙소 근처', '추천일정 1day · 장소1·장소2']) {
      expect(p).toContain(w)
    }
  })
})
