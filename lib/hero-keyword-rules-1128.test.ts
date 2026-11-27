/**
 * REGRESSION-FREEZE[hero-keyword-rules-1128]: 사장님 11/28 07:56 '대표사진 검색어는 Gemini 빼고 일정 원문 규칙으로 만들어'.
 * 대표사진 검색어 경로 Gemini 호출 0, 일정 원문(그날 장소) 규칙 검색어, 도시 이름만 금지.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const geminiSpy = vi.fn(() => {
  throw new Error('gemini must not be called')
})
vi.mock('@/lib/gemini-client', () => ({
  getGenAI: geminiSpy,
  getModelName: () => 'x',
  geminiTimeoutOpts: () => ({}),
}))

import {
  buildHeroKeywordInputsFromSchedule,
  heroKeywordCandidatesByDay,
  selectProductHeroPlaceKeyword,
} from '@/lib/product-hero-image-keyword'

const fetchSpy = vi.fn(async () => {
  throw new Error('network must not be called')
})

beforeEach(() => {
  geminiSpy.mockClear()
  fetchSpy.mockClear()
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const schedule = (rows: Array<Record<string, unknown>>) => JSON.stringify(rows)

describe('hero-keyword-rules-1128', () => {
  it('source has no Gemini/LLM call', () => {
    const src = readFileSync(join(process.cwd(), 'lib/product-hero-image-keyword.ts'), 'utf8')
    expect(src).not.toMatch(/gemini-client|getGenAI|generateContent|GoogleGenerativeAI/)
  })

  it('Gemini 0 calls and no network even with an API key set', async () => {
    const prev = process.env.GEMINI_API_KEY
    process.env.GEMINI_API_KEY = 'test-only'
    try {
      const r = await selectProductHeroPlaceKeyword({
        productId: 'p1',
        itineraryDays: buildHeroKeywordInputsFromSchedule(
          schedule([
            { day: 1, title: '싱가포르 도착', routeText: '인천 - 싱가포르', description: '', imageKeyword: 'Singapore' },
            { day: 2, title: '싱가포르 시내', routeText: '싱가포르 - 가든스 바이 더 베이 - 마리나 베이 샌즈', description: '', imageKeyword: '' },
          ]),
        ),
        cityEn: 'Singapore',
        destinationKr: '싱가포르',
      })
      expect(geminiSpy).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(r.keyword).toBe('Marina Bay Sands')
      expect(r.source).toBe('priority_map')
    } finally {
      if (prev === undefined) delete process.env.GEMINI_API_KEY
      else process.env.GEMINI_API_KEY = prev
    }
  })

  it('live sample pkg-lt-0021 day 2 text gives its own named place, not the city', async () => {
    const r = await selectProductHeroPlaceKeyword({
      productId: 'pkg-lt-0021',
      itineraryDays: buildHeroKeywordInputsFromSchedule(
        schedule([
          { day: 1, title: '싱가포르 도착', routeText: '인천 - 싱가포르', imageKeyword: 'Singapore' },
          { day: 2, title: '싱가포르 · 페라나칸', routeText: '싱가포르 - 리버보트 - 2층버스 - 윙스오브타임 - 스카이 파크 - 플라이어 - 페라나칸', description: '싱가포르와 리버보트를 둘러봅니다.', imageKeyword: '' },
        ]),
      ),
      cityEn: 'Singapore',
    })
    expect(geminiSpy).not.toHaveBeenCalled()
    expect(r.keyword).toBe('Peranakan Place')
    expect(r.keyword).not.toBe('Singapore')
  })

  it('city-only itinerary gives empty keyword with a reason (no city fallback)', async () => {
    const r = await selectProductHeroPlaceKeyword({
      productId: 'p2',
      itineraryDays: buildHeroKeywordInputsFromSchedule(
        schedule([
          { day: 1, title: '방콕 도착', routeText: '인천 - 방콕', imageKeyword: 'Bangkok' },
          { day: 2, title: '자유일정', routeText: '방콕', imageKeyword: 'Bangkok Thailand' },
        ]),
      ),
      cityEn: 'Bangkok',
      countryEn: 'Thailand',
    })
    expect(r.keyword).toBe('')
    expect(r.source).toBe('no_sight')
    expect(r.reasoning).toBe('itinerary_has_no_named_sight')
  })

  it('uses only each day own text (Great Wall on day 2 stays day 2)', () => {
    const c = heroKeywordCandidatesByDay(
      buildHeroKeywordInputsFromSchedule(
        schedule([
          { day: 1, title: '북경 도착', routeText: '인천 - 북경', imageKeyword: 'Beijing' },
          { day: 2, title: '만리장성', routeText: '북경 - 팔달령 만리장성', imageKeyword: '' },
        ]),
      ),
    )
    expect(c.filter((x) => x.day === 1)).toEqual([])
    expect(c.filter((x) => x.day === 2).map((x) => x.keyword)).toEqual(['Great Wall of China'])
  })

  it('other-day landmark in a day imageKeyword is not used for that day', () => {
    const c = heroKeywordCandidatesByDay(
      buildHeroKeywordInputsFromSchedule(
        schedule([
          { day: 1, title: '다낭 시내', routeText: '다낭 - 오행산', imageKeyword: 'Ba Na Hills' },
          { day: 2, title: '바나힐', routeText: '다낭 - 바나힐 - 골든브릿지', imageKeyword: 'Ba Na Hills' },
        ]),
      ),
    )
    expect(c.filter((x) => x.day === 1).map((x) => x.keyword)).not.toContain('Ba Na Hills')
  })

  it('stale cached label not in itinerary is ignored; matching cache is kept', async () => {
    const days = buildHeroKeywordInputsFromSchedule(
      schedule([
        { day: 1, title: '싱가포르', routeText: '가든스 바이 더 베이 - 멀라이언 파크', imageKeyword: '' },
      ]),
    )
    const stale = await selectProductHeroPlaceKeyword({ productId: 'p3', itineraryDays: days, cachedHeroPlaceKeyword: 'Eiffel Tower' })
    expect(stale.source).not.toBe('cache')
    expect(['Gardens by the Bay', 'Merlion Park']).toContain(stale.keyword)
    const kept = await selectProductHeroPlaceKeyword({ productId: 'p3', itineraryDays: days, cachedHeroPlaceKeyword: 'Merlion Park' })
    expect(kept).toMatchObject({ keyword: 'Merlion Park', source: 'cache' })
  })

  it('process-images logs hero keyword per product and puts the rule keyword first for cover search', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/travel/process-images/route.ts'), 'utf8')
    expect(src).toContain("kind: 'hero-keyword'")
    expect(src).toContain("kind: 'hero-keyword-result'")
    expect(src).toContain('coverSearchSights([mainQuery], [heroPick.keyword, ...dayKeywords])')
  })
})
