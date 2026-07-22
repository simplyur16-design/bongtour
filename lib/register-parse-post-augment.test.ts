/**
 * REGRESSION-FREEZE[register-post-augment-schedule-ssot]: post-augment SSOT hub + return-day merge — manifest
 */
import { describe, expect, it } from 'vitest'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
import { applyRegisterPostAugmentSchedulePipeline } from '@/lib/register-parse-post-augment'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'

const ADMIN_NOISE = '한국-일본 여행 입국시 관련 안내'

const TOTTORI_FACT_DAYS: RegisterFactScheduleDay[] = [
  {
    day: 1,
    places: ['인천', '돗토리', ADMIN_NOISE, '미즈키시게루 로드'],
    hotels: ['예정 호텔'],
    meals: [],
    transportNote: null,
  },
  {
    day: 2,
    places: ['요나고', '돗토리', '돗토리 사구 모래미술관', '20세기 배 기념관(나싯코관)', '코난 박물관 (아오야마 고쇼 기념관)'],
    hotels: ['예정 호텔'],
    meals: [],
    transportNote: null,
  },
  {
    day: 3,
    places: ['마츠에', '인천', '아다치 미술관', '마쓰에성', '시오미나와테 거리'],
    hotels: [],
    meals: [],
    transportNote: null,
  },
]

describe('register-parse-post-augment SSOT', () => {
  it('modetour post-augment keeps last-day keyword and trip-unique keywords', async () => {
    const built = modetourFactDaysToRegisterSchedule(TOTTORI_FACT_DAYS, { productTitle: '돗토리 3일' })
    const before = built.map((row) => ({
      ...row,
      imageKeyword: row.day === 3 ? 'Shiomi Nawate Samurai Street' : '',
      imageKeyword2: null,
    }))
    const parsed = {
      schedule: before,
      primaryDestination: '돗토리',
      destination: '돗토리',
      title: '돗토리 3일',
    }

    const after = await applyRegisterPostAugmentSchedulePipeline(parsed, {
      forcedBrandKey: 'modetour',
      travelScope: 'package',
      mode: 'preview',
    })

    const schedule = after.schedule ?? []
    expect(schedule.length).toBeGreaterThanOrEqual(3)
    const last = schedule[schedule.length - 1]
    expect(String(last?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)

    const used = new Set<string>()
    for (const row of schedule) {
      for (const slot of [row.imageKeyword, row.imageKeyword2]) {
        const kw = String(slot ?? '').trim()
        if (!kw) continue
        const nk = normScheduleImageKeywordKey(kw)
        expect(used.has(nk)).toBe(false)
        used.add(nk)
      }
    }
  })

  it('modetour post-augment removes admin noise from routeText', async () => {
    const built = modetourFactDaysToRegisterSchedule(TOTTORI_FACT_DAYS, { productTitle: '돗토리 3일' })
    const parsed = {
      schedule: built,
      primaryDestination: '돗토리',
      destination: '돗토리',
      title: '돗토리 3일',
    }
    const after = await applyRegisterPostAugmentSchedulePipeline(parsed, {
      forcedBrandKey: 'modetour',
      travelScope: 'package',
      mode: 'preview',
    })
    for (const row of after.schedule ?? []) {
      expect(String(row.routeText ?? '')).not.toMatch(/관련\s*안내/u)
    }
  })

  it('preview mode skips Gemini path (rules-only; wall-clock stays local)', async () => {
    process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI = '0'
    const built = modetourFactDaysToRegisterSchedule(TOTTORI_FACT_DAYS, { productTitle: '돗토리 3일' })
    const before = built.map((row) => ({
      ...row,
      imageKeyword: '',
      imageKeyword2: null,
    }))
    const t0 = Date.now()
    const after = await applyRegisterPostAugmentSchedulePipeline(
      {
        schedule: before,
        primaryDestination: '돗토리',
        destination: '돗토리',
        title: '돗토리 3일',
      } as never,
      { forcedBrandKey: 'modetour', travelScope: 'package', mode: 'preview' },
    )
    expect(Date.now() - t0).toBeLessThan(5_000)
    expect((after.schedule ?? []).length).toBeGreaterThan(0)
  })

  it('confirm + persisted preview keywords skips Gemini wipe/reapply', async () => {
    process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI = '0'
    const built = modetourFactDaysToRegisterSchedule(TOTTORI_FACT_DAYS, { productTitle: '돗토리 3일' })
    const before = built.map((row) => ({
      ...row,
      imageKeyword:
        row.day === 1
          ? 'Incheon Departure'
          : row.day === 2
            ? 'Tottori Sand Museum'
            : 'Adachi Museum of Art',
      imageKeyword2: null,
    }))
    const t0 = Date.now()
    const after = await applyRegisterPostAugmentSchedulePipeline(
      {
        schedule: before,
        primaryDestination: '돗토리',
        destination: '돗토리',
        title: '돗토리 3일',
      } as never,
      {
        forcedBrandKey: 'modetour',
        travelScope: 'package',
        mode: 'confirm',
        hasPersistedParsed: true,
      },
    )
    expect(Date.now() - t0).toBeLessThan(500)
    const d2 = (after.schedule ?? []).find((r) => Number(r.day) === 2)
    expect(String(d2?.imageKeyword ?? '')).toBe('Tottori Sand Museum')
  })

  // REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: confirm skip when preview kw filled — manifest
  // REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: empty middle recovers (no sticky skip) — manifest
  it('confirm + persisted — empty middle Day4 recovers via rules (no sticky skip)', async () => {
    process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI = '1'
    const schedule = [
      { day: 1, title: '깜란', routeText: '깜란 - 나트랑', imageKeyword: 'Cam Ranh Bay', imageKeyword2: null },
      {
        day: 2,
        title: '나트랑',
        routeText: '나트랑 - 포나가르 참 사원',
        imageKeyword: 'Po Nagar Cham Towers',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '달랏',
        routeText: '달랏 - 꾸란마을',
        imageKeyword: 'Da Lat Vietnam Highland',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '달랏',
        routeText: '달랏 - 나트랑 - 빈펄 하버랜드',
        imageKeyword: '',
        imageKeyword2: null,
      },
      { day: 5, title: '나트랑', routeText: '나트랑', imageKeyword: '', imageKeyword2: null },
    ]
    const after = await applyRegisterPostAugmentSchedulePipeline(
      {
        schedule,
        primaryDestination: '베트남',
        destination: '미지정',
        title: '나트랑/달랏 5일',
      } as never,
      {
        forcedBrandKey: 'ybtour',
        travelScope: 'package',
        mode: 'confirm',
        hasPersistedParsed: true,
      },
    )
    const d4 = String((after.schedule ?? []).find((r) => r.day === 4)?.imageKeyword ?? '').trim()
    expect(d4.length).toBeGreaterThan(0)
    expect(d4).toMatch(/Vinpearl|Harbourland|Nha Trang|Da Lat/i)
  })
})
