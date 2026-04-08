/**
 * 참좋은여행 docx 단락 본문 → parseForRegisterVerygoodtour (LLM) → schedule + itinerary draft 전체 덤프.
 * 실행: npx tsx scripts/verify-verygoodtour-paste-llm-once.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseForRegisterVerygoodtour } from '@/lib/register-parse-verygoodtour'
import {
  augmentVerygoodtourScheduleExpressionParsed,
  finalizeVerygoodtourItineraryDayDraftsFromSchedule,
} from '@/lib/parse-and-register-verygoodtour-schedule'
import { registerScheduleToDayInputs } from '@/lib/upsert-itinerary-days-verygoodtour'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const raw = fs.readFileSync(path.join(__dirname, '.tmp-paste-verify/verygoodtour-para.txt'), 'utf8')
  let parsed = await parseForRegisterVerygoodtour(raw, 'paste-verify', {
    forPreview: false,
    skipDetailSectionGeminiRepairs: true,
    maxDetailSectionRepairs: 3,
  })
  if ((parsed.schedule?.length ?? 0) === 0 && raw.trim()) {
    parsed = await parseForRegisterVerygoodtour(raw, 'paste-verify', {
      forPreview: false,
      skipDetailSectionGeminiRepairs: false,
      maxDetailSectionRepairs: 3,
    })
  }
  const aug = augmentVerygoodtourScheduleExpressionParsed(parsed)
  const schedule = aug.schedule ?? []
  let drafts = registerScheduleToDayInputs(schedule)
  drafts = finalizeVerygoodtourItineraryDayDraftsFromSchedule(drafts, schedule)

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
