/**
 * scripts/.tmp-paste-verify/*-para.txt → 공급사별 parse + augment + finalize(해당 시) 후
 * 일정 노출 축(schedule + itinerary drafts)에 약관성 문구 잔존 여부를 실측한다.
 *
 * 실행: npx tsx scripts/verify-counseling-terms-from-para.ts
 * 요구: GEMINI_API_KEY(.env / .env.local) — 네 공급사 LLM 연쇄 호출로 수 분 이상 걸릴 수 있음.
 *
 * strip 모듈만 빠르게 실측할 때: npx tsx scripts/verify-counseling-terms-strip-static.ts (초 단위, 동일 para 파일)
 */
import fs from 'fs'
import path from 'path'

const PARA_DIR = path.join(process.cwd(), 'scripts', '.tmp-paste-verify')

/** 일정 노출 텍스트에 남아 있으면 안 되는 패턴(실측 FAIL) */
const FORBIDDEN: Array<{ id: string; re: RegExp }> = [
  { id: '표준약관', re: /국외\s*여행\s*표준약관|국내\s*여행\s*표준약관|여행\s*표준약관/ },
  { id: '특별약관', re: /특별약관/ },
  { id: '취소수수료_헤더', re: /약관\s*\/\s*취소수수료|■\s*취소수수료|취소수수료\s*규정/ },
  { id: '예약금_규정', re: /■\s*예약금|예약금\s*규정|예약금\s*전액/ },
  { id: '계약금_환불', re: /계약금\s*환불|계약금\s*규정/ },
  { id: '환불규정', re: /환불규정|취소환불규정/ },
  { id: '취소료규정', re: /취소료\s*규정/ },
  { id: '예약후24시간', re: /예약\s*후\s*\d{1,2}\s*시간\s*내/ },
  { id: '여행요금_배상', re: /여행요금의\s*\d+\s*%|배상하여야\s*합니다/ },
  { id: '발권후_패널티', re: /발권\s*후\s*취소\s*패널티|항공권\s*발권\s*이후.*패널티/ },
  { id: '국외여행표준약관_조문', re: /표준약관\s*제\s*\d+\s*조/ },
  { id: '예약과취소_표준약관', re: /예약과\s*취소는.*표준약관/ },
]

/** 입력 본문에 있을 때 출력에도 남아 있어야 하는 항공 신호(일부만 있어도 OK) */
const FLIGHT_SIGNAL = /항공|공항|편명|출발|도착|ICN|GMP|[A-Z]{2}\s*\d{3,4}/

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

function collectScheduleDraftText(
  schedule: Array<{
    title?: string
    description?: string
    hotelText?: string | null
    breakfastText?: string | null
    lunchText?: string | null
    dinnerText?: string | null
    mealSummaryText?: string | null
  }>,
  drafts: Array<{
    summaryTextRaw?: string | null
    rawBlock?: string | null
    hotelText?: string | null
    breakfastText?: string | null
    lunchText?: string | null
    dinnerText?: string | null
    mealSummaryText?: string | null
    meals?: string | null
  }>
): string {
  const parts: string[] = []
  for (const r of schedule) {
    parts.push(
      r.title ?? '',
      r.description ?? '',
      r.hotelText ?? '',
      r.breakfastText ?? '',
      r.lunchText ?? '',
      r.dinnerText ?? '',
      r.mealSummaryText ?? ''
    )
  }
  for (const d of drafts) {
    parts.push(
      d.summaryTextRaw ?? '',
      d.rawBlock ?? '',
      d.hotelText ?? '',
      d.breakfastText ?? '',
      d.lunchText ?? '',
      d.dinnerText ?? '',
      d.mealSummaryText ?? '',
      d.meals ?? ''
    )
  }
  return parts.join('\n')
}

function findForbidden(haystack: string): Array<{ id: string; sample: string }> {
  const found: Array<{ id: string; sample: string }> = []
  for (const { id, re } of FORBIDDEN) {
    re.lastIndex = 0
    const m = haystack.match(re)
    if (m) found.push({ id, sample: m[0].slice(0, 120) })
  }
  return found
}

type SupplierResult = {
  supplier: string
  inputPath: string
  scheduleDays: number
  draftDays: number
  inputHasFlightSignal: boolean
  outputHasFlightSignal: boolean
  forbiddenHits: Array<{ id: string; sample: string }>
  error?: string
}

async function runHanatour(text: string, inputPath: string): Promise<SupplierResult> {
  const { parseForRegisterHanatour } = await import('../lib/register-parse-hanatour')
  const {
    augmentHanatourScheduleExpressionParsed,
    finalizeHanatourItineraryDayDraftsFromSchedule,
  } = await import('../lib/parse-and-register-hanatour-schedule')
  const { registerScheduleToDayInputs } = await import('../lib/upsert-itinerary-days-hanatour')

  let merged = await parseForRegisterHanatour(text, '직접입력', {
    forPreview: true,
    skipDetailSectionGeminiRepairs: true,
  })
  if ((merged.schedule?.length ?? 0) === 0 && text.trim()) {
    const full = await parseForRegisterHanatour(text, '직접입력', {
      forPreview: false,
      skipDetailSectionGeminiRepairs: true,
    })
    merged = {
      ...merged,
      schedule: full.schedule ?? [],
      dayHotelPlans:
        full.dayHotelPlans?.length && !(merged.dayHotelPlans?.length)
          ? full.dayHotelPlans
          : merged.dayHotelPlans,
    }
  }
  const aug = augmentHanatourScheduleExpressionParsed(merged)
  const schedule = aug.schedule ?? []
  let drafts = registerScheduleToDayInputs(schedule)
  drafts = finalizeHanatourItineraryDayDraftsFromSchedule(drafts, schedule)
  const exposed = collectScheduleDraftText(schedule, drafts)
  return {
    supplier: 'hanatour',
    inputPath,
    scheduleDays: schedule.length,
    draftDays: drafts.length,
    inputHasFlightSignal: FLIGHT_SIGNAL.test(text),
    outputHasFlightSignal: FLIGHT_SIGNAL.test(exposed),
    forbiddenHits: findForbidden(exposed),
  }
}

async function runModetour(text: string, inputPath: string): Promise<SupplierResult> {
  const { parseForRegisterModetour } = await import('../lib/register-parse-modetour')
  const { registerScheduleToDayInputs } = await import('../lib/upsert-itinerary-days-modetour')
  const { stripCounselingTermsFromItineraryDayDraft } = await import(
    '../lib/itinerary-counseling-terms-strip'
  )

  const parsed = await parseForRegisterModetour(text, 'modetour-para-verify', {
    forPreview: false,
    skipDetailSectionGeminiRepairs: true,
    maxDetailSectionRepairs: 3,
  })
  const schedule = parsed.schedule ?? []
  let drafts = registerScheduleToDayInputs(schedule)
  drafts = drafts.map(stripCounselingTermsFromItineraryDayDraft)
  const exposed = collectScheduleDraftText(schedule, drafts)
  return {
    supplier: 'modetour',
    inputPath,
    scheduleDays: schedule.length,
    draftDays: drafts.length,
    inputHasFlightSignal: FLIGHT_SIGNAL.test(text),
    outputHasFlightSignal: FLIGHT_SIGNAL.test(exposed),
    forbiddenHits: findForbidden(exposed),
  }
}

async function runVerygood(text: string, inputPath: string): Promise<SupplierResult> {
  const { parseForRegisterVerygoodtour } = await import('../lib/register-parse-verygoodtour')
  const {
    augmentVerygoodtourScheduleExpressionParsed,
    finalizeVerygoodtourItineraryDayDraftsFromSchedule,
  } = await import('../lib/parse-and-register-verygoodtour-schedule')
  const { registerScheduleToDayInputs } = await import('../lib/upsert-itinerary-days-verygoodtour')

  let merged = await parseForRegisterVerygoodtour(text, 'verygood-para-verify', {
    forPreview: true,
  })
  if ((merged.schedule?.length ?? 0) === 0 && text.trim()) {
    const full = await parseForRegisterVerygoodtour(text, 'verygood-para-verify', {
      forPreview: false,
      skipDetailSectionGeminiRepairs: true,
      maxDetailSectionRepairs: 3,
    })
    merged = {
      ...merged,
      schedule: full.schedule ?? [],
      dayHotelPlans:
        full.dayHotelPlans?.length && !(merged.dayHotelPlans?.length)
          ? full.dayHotelPlans
          : merged.dayHotelPlans,
    }
  }
  const aug = augmentVerygoodtourScheduleExpressionParsed(merged)
  const schedule = aug.schedule ?? []
  let drafts = registerScheduleToDayInputs(schedule)
  drafts = finalizeVerygoodtourItineraryDayDraftsFromSchedule(drafts, schedule)
  const exposed = collectScheduleDraftText(schedule, drafts)
  return {
    supplier: 'verygoodtour',
    inputPath,
    scheduleDays: schedule.length,
    draftDays: drafts.length,
    inputHasFlightSignal: FLIGHT_SIGNAL.test(text),
    outputHasFlightSignal: FLIGHT_SIGNAL.test(exposed),
    forbiddenHits: findForbidden(exposed),
  }
}

async function runYbtour(text: string, inputPath: string): Promise<SupplierResult> {
  const { parseForRegisterYbtour } = await import('../lib/register-parse-ybtour')
  const {
    augmentYbtourScheduleExpressionParsed,
    finalizeYbtourItineraryDayDraftsFromSchedule,
  } = await import('../lib/parse-and-register-ybtour-schedule')
  const { sanitizeYbtourRegisterParsedStrings } = await import('../lib/register-ybtour-text-sanitize')
  const { registerScheduleToDayInputs } = await import('../lib/upsert-itinerary-days-ybtour')

  let merged = await parseForRegisterYbtour(text, 'ybtour-para-verify', {
    forPreview: true,
  })
  if ((merged.schedule?.length ?? 0) === 0 && text.trim()) {
    const full = await parseForRegisterYbtour(text, 'ybtour-para-verify', {
      forPreview: false,
      skipDetailSectionGeminiRepairs: true,
      maxDetailSectionRepairs: 3,
    })
    merged = {
      ...merged,
      schedule: full.schedule ?? [],
      dayHotelPlans:
        full.dayHotelPlans?.length && !(merged.dayHotelPlans?.length)
          ? full.dayHotelPlans
          : merged.dayHotelPlans,
    }
  }
  const aug = sanitizeYbtourRegisterParsedStrings(augmentYbtourScheduleExpressionParsed(merged, text))
  const schedule = aug.schedule ?? []
  let drafts = registerScheduleToDayInputs(schedule)
  drafts = finalizeYbtourItineraryDayDraftsFromSchedule(drafts, schedule)
  const exposed = collectScheduleDraftText(schedule, drafts)
  return {
    supplier: 'ybtour',
    inputPath,
    scheduleDays: schedule.length,
    draftDays: drafts.length,
    inputHasFlightSignal: FLIGHT_SIGNAL.test(text),
    outputHasFlightSignal: FLIGHT_SIGNAL.test(exposed),
    forbiddenHits: findForbidden(exposed),
  }
}

async function main() {
  loadEnvForTsx()
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.error('GEMINI_API_KEY is not set — cannot run LLM 실측.')
    process.exit(1)
  }

  const jobs: Array<{ name: string; file: string; fn: (t: string, p: string) => Promise<SupplierResult> }> = [
    { name: 'hanatour', file: 'hanatour-para.txt', fn: runHanatour },
    { name: 'modetour', file: 'modetour-para.txt', fn: runModetour },
    { name: 'verygoodtour', file: 'verygoodtour-para.txt', fn: runVerygood },
    { name: 'ybtour', file: 'ybtour-para.txt', fn: runYbtour },
  ]

  const results: SupplierResult[] = []
  let exitCode = 0

  for (const j of jobs) {
    const inputPath = path.join(PARA_DIR, j.file)
    if (!fs.existsSync(inputPath)) {
      console.error(`[MISSING] ${inputPath}`)
      results.push({
        supplier: j.name,
        inputPath,
        scheduleDays: 0,
        draftDays: 0,
        inputHasFlightSignal: false,
        outputHasFlightSignal: false,
        forbiddenHits: [],
        error: 'file not found',
      })
      exitCode = 1
      continue
    }
    const text = fs.readFileSync(inputPath, 'utf8')
    try {
      const r = await j.fn(text, inputPath)
      results.push(r)
      console.log(`\n=== ${j.name} ===`)
      console.log('path:', inputPath)
      console.log('scheduleDays:', r.scheduleDays, 'draftDays:', r.draftDays)
      console.log('input flight signal:', r.inputHasFlightSignal, '→ output:', r.outputHasFlightSignal)
      if (r.forbiddenHits.length) {
        console.log('FORBIDDEN REMAIN:', JSON.stringify(r.forbiddenHits, null, 2))
        exitCode = 1
      } else {
        console.log('FORBIDDEN REMAIN: (none)')
      }
      if (r.inputHasFlightSignal && r.scheduleDays > 0 && !r.outputHasFlightSignal) {
        console.warn('WARN: input had flight-like text but exposed itinerary has no flight signal — check 항공여정 유지')
        exitCode = 1
      }
    } catch (e) {
      console.error(`[ERROR] ${j.name}`, e)
      results.push({
        supplier: j.name,
        inputPath,
        scheduleDays: 0,
        draftDays: 0,
        inputHasFlightSignal: FLIGHT_SIGNAL.test(text),
        outputHasFlightSignal: false,
        forbiddenHits: [],
        error: String(e),
      })
      exitCode = 1
    }
  }

  console.log('\n=== AGGREGATE ===')
  console.log(JSON.stringify(results, null, 2))
  process.exit(exitCode)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
