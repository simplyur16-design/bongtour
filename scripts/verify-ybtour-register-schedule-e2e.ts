/**
 * ybtour — tmp_ybtour_body.txt 붙여넣기 본문으로 일정 표현층 E2E (preview + 복구 + augment + finalize).
 * 핸들러와 동일: augment → sanitize, 복구는 orchestration과 동일 parseFn 인자.
 * 실행: npx tsx scripts/verify-ybtour-register-schedule-e2e.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import fs from 'fs'
import path from 'path'

const DAY_N_TRAVEL_RE = /^day\s*\d+\s*travel$/i

function loadEnvFile(fileName: string) {
  const p = path.join(process.cwd(), fileName)
  if (!fs.existsSync(p)) return
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function loadEnvForTsx() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
}

function buildScheduleJson(
  rows: Array<{ day: number; title: string; description: string; imageKeyword: string }>
) {
  return JSON.stringify(
    rows.map((d) => ({
      day: d.day,
      title: d.title,
      description: d.description,
      imageKeyword: d.imageKeyword,
      imageUrl: null,
    }))
  )
}

async function main() {
  loadEnvForTsx()
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.error('GEMINI_API_KEY is not set (.env / .env.local); cannot run LLM E2E.')
    process.exit(1)
  }

  const { parseForRegisterYbtour } = await import('../lib/register-parse-ybtour')
  const {
    augmentYbtourScheduleExpressionParsed,
    finalizeYbtourItineraryDayDraftsFromSchedule,
    ybtourConfirmHasScheduleExpressionLayer,
  } = await import('../lib/parse-and-register-ybtour-schedule')
  const { sanitizeYbtourRegisterParsedStrings } = await import('../lib/register-ybtour-text-sanitize')
  const { registerScheduleToDayInputs } = await import('../lib/upsert-itinerary-days-ybtour')

  const bodyPath = path.join(process.cwd(), 'tmp_ybtour_body.txt')
  if (!fs.existsSync(bodyPath)) {
    console.error(
      'Missing tmp_ybtour_body.txt — place a real ybtour paste at repo root (e.g. extract from Desktop docx containing ybtour.co.kr).'
    )
    process.exit(1)
  }

  const text = fs.readFileSync(bodyPath, 'utf8')
  const originSource = 'ybtour'

  console.log('--- Preview parse (forPreview: true), handler parity ---')
  const preview = await parseForRegisterYbtour(text, originSource, {
    forPreview: true,
  })
  console.log('preview.schedule.length', preview.schedule?.length ?? 0)

  let merged = preview
  if ((preview.schedule?.length ?? 0) === 0 && text.trim()) {
    console.log('--- Recovery full parse (orchestration ybtour-recover parity) ---')
    const full = await parseForRegisterYbtour(text, originSource, {
      forPreview: false,
      skipDetailSectionGeminiRepairs: true,
      maxDetailSectionRepairs: 3,
    })
    merged = {
      ...preview,
      schedule: full.schedule ?? [],
      dayHotelPlans:
        full.dayHotelPlans?.length && !(preview.dayHotelPlans?.length)
          ? full.dayHotelPlans
          : preview.dayHotelPlans,
    }
    console.log('after recovery schedule.length', merged.schedule?.length ?? 0)
  }

  const aug = sanitizeYbtourRegisterParsedStrings(augmentYbtourScheduleExpressionParsed(merged, text))
  const schedule = aug.schedule ?? []

  const badKw = schedule.filter((r) => DAY_N_TRAVEL_RE.test(String(r.imageKeyword ?? '').trim()))
  console.log('Day N travel rows after augment:', badKw.length)

  let drafts = registerScheduleToDayInputs(schedule)
  drafts = finalizeYbtourItineraryDayDraftsFromSchedule(drafts, schedule)
  const productScheduleJson = buildScheduleJson(schedule)

  console.log('\nybtourConfirmHasScheduleExpressionLayer:', ybtourConfirmHasScheduleExpressionLayer(aug, drafts))

  console.log('\n=== SCHEDULE (per day) ===')
  for (const r of schedule) {
    console.log(
      JSON.stringify(
        {
          day: r.day,
          title: r.title,
          description: r.description,
          imageKeyword: r.imageKeyword,
          hotelText: r.hotelText,
          meals: { b: r.breakfastText, l: r.lunchText, d: r.dinnerText, sum: r.mealSummaryText },
        },
        null,
        0
      )
    )
  }

  console.log('\n=== ITINERARY DAY DRAFTS ===')
  for (const d of drafts) {
    console.log(
      JSON.stringify(
        {
          day: d.day,
          summaryTextRaw: d.summaryTextRaw,
          rawBlock: d.rawBlock,
          hotelText: d.hotelText,
          accommodation: d.accommodation,
          breakfastText: d.breakfastText,
          lunchText: d.lunchText,
          dinnerText: d.dinnerText,
          mealSummaryText: d.mealSummaryText,
          meals: d.meals,
        },
        null,
        0
      )
    )
  }

  console.log('\n=== Product.schedule JSON length ===', productScheduleJson.length)

  let mismatch = 0
  for (const r of schedule) {
    const d = drafts.find((x) => x.day === r.day)
    if (!d) {
      console.error('Missing draft for day', r.day)
      mismatch++
      continue
    }
    const desc = String(r.description ?? '').trim()
    const title = String(r.title ?? '').trim()
    const expectedSummary = desc || title || ''
    const sum = String(d.summaryTextRaw ?? '').trim()
    if (expectedSummary && sum !== expectedSummary.trim()) {
      console.warn('summaryTextRaw vs description||title day', r.day, {
        summaryTextRaw: sum.slice(0, 100),
        expected: expectedSummary.slice(0, 100),
      })
      mismatch++
    }
    const rb = d.rawBlock ? (JSON.parse(d.rawBlock) as Record<string, string>) : null
    if (rb && (rb.title !== r.title || rb.description !== r.description || rb.imageKeyword !== r.imageKeyword)) {
      console.warn('rawBlock mismatch day', r.day, rb)
      mismatch++
    }
    const ht = d.hotelText?.trim()
    if (ht && !['-', '—', '–'].includes(ht) && d.accommodation?.trim() !== ht) {
      console.warn('hotelText/accommodation mismatch day', r.day)
      mismatch++
    }
  }

  const jsonRows = JSON.parse(productScheduleJson) as Array<{
    day: number
    title: string
    description: string
    imageKeyword: string
  }>
  for (const r of schedule) {
    const j = jsonRows.find((x) => x.day === r.day)
    if (!j || j.title !== r.title || j.description !== r.description || j.imageKeyword !== r.imageKeyword) {
      console.warn('Product.schedule JSON row mismatch day', r.day)
      mismatch++
    }
  }

  if (schedule.length === 0) {
    console.error('FAIL: schedule empty after recovery')
    mismatch++
  }
  if (badKw.length > 0) mismatch++
  if (!ybtourConfirmHasScheduleExpressionLayer(aug, drafts)) {
    console.error('FAIL: ybtourConfirmHasScheduleExpressionLayer false')
    mismatch++
  }

  /** tmp_ybtour_body.txt 고정 E2E: 누락 보강 후 4일·Day4 꼬리·호텔 빈값 */
  const TAIL_NOISE_RE = /선택관광명|#선택옵션|마사지실\s*또는\s*호텔|\$\d+\/\s*인/
  if (schedule.length !== 4) {
    console.error('FAIL: expected final schedule length 4 for tmp_ybtour_body.txt, got', schedule.length)
    mismatch++
  }
  if (drafts.length !== 4) {
    console.error('FAIL: expected itineraryDayDrafts length 4, got', drafts.length)
    mismatch++
  }
  if (jsonRows.length !== 4) {
    console.error('FAIL: expected Product.schedule JSON rows 4, got', jsonRows.length)
    mismatch++
  }
  const day4 = schedule.find((r) => r.day === 4)
  if (day4) {
    const desc4 = String(day4.description ?? '')
    if (TAIL_NOISE_RE.test(desc4)) {
      console.error('FAIL: Day 4 description contains tail/option-list noise', desc4.slice(0, 120))
      mismatch++
    }
    const ht4 = day4.hotelText?.trim()
    if (ht4) {
      console.error('FAIL: Day 4 hotelText should stay empty for this paste, got:', ht4.slice(0, 80))
      mismatch++
    }
  }

  console.log('\n=== SUMMARY ===')
  console.log('schedule days:', schedule.length, 'drafts:', drafts.length, 'checks failed:', mismatch)
  process.exit(mismatch > 0 ? 2 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
