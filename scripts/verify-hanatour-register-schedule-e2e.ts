/**
 * 하나투어.docx → tmp_hanatour_body.txt 추출 본문으로 일정 표현층 E2E (preview 복구 + draft + 저장 JSON 형태).
 * 실행: npx tsx scripts/verify-hanatour-register-schedule-e2e.ts
 * 요구: GEMINI_API_KEY(.env / .env.local), tmp_hanatour_body.txt (프로젝트 루트)
 *
 * 주의: gemini-client는 모듈 로드 시점에 API 키를 읽으므로, lib 동적 import 전에 env를 채운다.
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

/** .env.local 먼저(값 있으면 유지), 없는 키만 .env로 보강 */
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

  const { parseForRegisterHanatour } = await import('../lib/register-parse-hanatour')
  const {
    augmentHanatourScheduleExpressionParsed,
    finalizeHanatourItineraryDayDraftsFromSchedule,
  } = await import('../lib/parse-and-register-hanatour-schedule')
  const { registerScheduleToDayInputs } = await import('../lib/upsert-itinerary-days-hanatour')

  const bodyPath = path.join(process.cwd(), 'tmp_hanatour_body.txt')
  if (!fs.existsSync(bodyPath)) {
    console.error('Missing tmp_hanatour_body.txt — extract 하나투어.docx text to repo root first.')
    process.exit(1)
  }

  const text = fs.readFileSync(bodyPath, 'utf8')
  const originSource = '직접입력'

  console.log('--- Preview parse (forPreview: true) ---')
  const preview = await parseForRegisterHanatour(text, originSource, {
    forPreview: true,
    skipDetailSectionGeminiRepairs: true,
  })
  console.log('preview.schedule.length', preview.schedule?.length ?? 0)

  let merged = preview
  if ((preview.schedule?.length ?? 0) === 0) {
    console.log('--- Recovery full parse (forPreview: false), orchestration parity ---')
    const full = await parseForRegisterHanatour(text, originSource, {
      forPreview: false,
      skipDetailSectionGeminiRepairs: true,
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

  console.log('--- augmentHanatourScheduleExpressionParsed ---')
  const aug = augmentHanatourScheduleExpressionParsed(merged)
  const schedule = aug.schedule ?? []

  const badKw = schedule.filter((r) => DAY_N_TRAVEL_RE.test(String(r.imageKeyword ?? '').trim()))
  console.log('Day N travel rows after augment:', badKw.length)

  const draftsBefore = registerScheduleToDayInputs(schedule)
  const drafts = finalizeHanatourItineraryDayDraftsFromSchedule(draftsBefore, schedule)
  const productScheduleJson = buildScheduleJson(schedule)

  console.log('\n=== PREVIEW/AUG SCHEDULE (per day) ===')
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

  console.log('\n=== SUMMARY ===')
  console.log('schedule days:', schedule.length, 'drafts:', drafts.length, 'checks failed:', mismatch)
  process.exit(mismatch > 0 ? 2 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
