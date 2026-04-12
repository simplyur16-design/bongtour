/**
 * 하나투어 docx 단락 본문 → parseForRegisterHanatour (LLM) → schedule + itinerary draft 전체 덤프.
 * 실행: npx tsx scripts/verify-hanatour-paste-llm-once.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseForRegisterHanatour } from '@/lib/register-parse-hanatour'
import {
  augmentHanatourScheduleExpressionParsed,
  finalizeHanatourItineraryDayDraftsFromSchedule,
} from '@/lib/parse-and-register-hanatour-schedule'
import { registerScheduleToDayInputs } from '@/lib/upsert-itinerary-days-hanatour'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const raw = fs.readFileSync(path.join(__dirname, '.tmp-paste-verify/hanatour-para.txt'), 'utf8')
  const parsed = await parseForRegisterHanatour(raw, 'paste-verify', {})
  const aug = augmentHanatourScheduleExpressionParsed(parsed)
  const schedule = aug.schedule ?? []
  let drafts = registerScheduleToDayInputs(schedule)
  drafts = finalizeHanatourItineraryDayDraftsFromSchedule(drafts, schedule)

  const scheduleDump = schedule.map((s) => ({
    day: s.day,
    title: s.title ?? '',
    description: s.description ?? '',
    imageKeyword: s.imageKeyword ?? '',
    hotelText: s.hotelText ?? null,
    breakfastText: s.breakfastText ?? null,
    lunchText: s.lunchText ?? null,
    dinnerText: s.dinnerText ?? null,
    mealSummaryText: s.mealSummaryText ?? null,
  }))

  const draftDump = drafts.map((d) => ({
    day: d.day,
    summaryTextRaw: d.summaryTextRaw ?? null,
    rawBlock: d.rawBlock != null ? String(d.rawBlock).slice(0, 500) : null,
    hotelText: d.hotelText ?? null,
    accommodation: d.accommodation ?? null,
    breakfastText: d.breakfastText ?? null,
    lunchText: d.lunchText ?? null,
    dinnerText: d.dinnerText ?? null,
    mealSummaryText: d.mealSummaryText ?? null,
    meals: d.meals ?? null,
  }))

  console.log(
    JSON.stringify(
      {
        scheduleLength: schedule.length,
        itineraryInputCount: drafts.length,
        schedule: scheduleDump,
        itineraryDrafts: draftDump,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
