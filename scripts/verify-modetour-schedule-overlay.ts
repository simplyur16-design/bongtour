/**
 * `npx tsx scripts/verify-modetour-schedule-overlay.ts`
 * 짧은 요약·식사 미검출 경로에서도 schedule의 hotelText/식사 병합이 빠지지 않는지 회귀 방지.
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import assert from 'node:assert/strict'
import { extractModetourMealSummaryFromScheduleDescription } from '../lib/register-modetour-meal-from-description'
import {
  modetourItineraryDraftsApplyParsedScheduleOverlay,
  modetourItineraryDraftsApplyScheduleHotelBodyFirst,
} from '../lib/modetour-itinerary-schedule-overlay'
import type { ItineraryDayInput } from '../lib/upsert-itinerary-days-modetour'

type SchedRow = {
  day: number
  title?: string
  description?: string
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
}

// 스크래핑 초안: 식사 없음, 긴 요약(실제로는 HTML)
const scraperDrafts: ItineraryDayInput[] = [1, 2, 3, 4].map((day) => ({
  day,
  summaryTextRaw: `DAY${day} 긴 스크래핑 요약 `.repeat(20),
  hotelText: null,
  breakfastText: null,
  lunchText: null,
  dinnerText: null,
  mealSummaryText: null,
  meals: null,
}))

// 붙여넣기 schedule: 제목만 짧고 description 비어 있음 → registerScheduleToDayInputs brief < 8, hasMeal false
const scheduleShortTitleHotelOnly: SchedRow[] = [1, 2, 3, 4].map((day) => ({
  day,
  title: 'x',
  description: '',
  hotelText: `타오가든 호텔 외 10개 (일차${day} 검증)`,
}))

let merged = modetourItineraryDraftsApplyScheduleHotelBodyFirst(scraperDrafts, scheduleShortTitleHotelOnly)
merged = modetourItineraryDraftsApplyParsedScheduleOverlay(merged, scheduleShortTitleHotelOnly as never)

for (const d of merged) {
  assert.ok(
    d.hotelText?.includes('타오가든'),
    `day ${d.day}: 짧은 요약 경로에서도 schedule hotelText가 반영되어야 함 (got ${d.hotelText})`
  )
}

// description에 식사 블록(모두투어형) — HTML 태그 포함 시에도 추출
const descWithTags = `<div>관광</div>
식사
조식 - 기내식 없음(불포함), 중식 - 현지식, 석식 - 딤섬특식`

const extracted = extractModetourMealSummaryFromScheduleDescription(descWithTags)
assert.ok(extracted && /조식|중식|석식/.test(extracted), `식사 추출 실패: ${extracted}`)

const scheduleWithMealDesc: SchedRow[] = [
  {
    day: 1,
    title: 'a',
    description: descWithTags,
    hotelText: 'H1',
  },
]

const draftOne: ItineraryDayInput[] = [
  {
    day: 1,
    summaryTextRaw: '스크래핑만',
    hotelText: null,
    breakfastText: null,
    lunchText: null,
    dinnerText: null,
    mealSummaryText: null,
    meals: null,
  },
]

let m2 = modetourItineraryDraftsApplyScheduleHotelBodyFirst(draftOne, scheduleWithMealDesc)
m2 = modetourItineraryDraftsApplyParsedScheduleOverlay(m2, scheduleWithMealDesc as never)
assert.ok(m2[0]?.mealSummaryText || m2[0]?.meals, `식사 병합 기대: ${JSON.stringify(m2[0])}`)
assert.equal(m2[0]?.hotelText, 'H1')

console.log('verify-modetour-schedule-overlay: ok')
