/**
 * 교원이지(kyowontour) — 일정(schedule)만 별도 Gemini 호출로 추출 (Phase 2-B).
 * `register-llm.ts` 단일 호출의 MAX_TOKENS·일정 품질 리스크를 줄인다.
 *
 * 참고: `lib/register-schedule-extract-modetour.ts` (프롬프트·JSON 모드 패턴).
 */
import { buildScheduleExtractToneBlock } from '@/lib/bongtour-tone-manner-llm-ssot'
import { geminiTimeoutOpts, getGenAI, getModelName, GEMINI_GENERATE_TIMEOUT_MS, testGeminiConnection } from '@/lib/gemini-client'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'
import { clipKyowontourRegisterBodyText, type KyowontourScheduleDayParsed } from '@/lib/kyowontour/register-llm'

const INFER_DAY_SCAN_MAX = 500_000

const KYOWONTOUR_SCHEDULE_EXTRACT_MAX_OUTPUT_TOKENS = Math.max(
  8192,
  Math.min(16_384, Number(process.env.KYOWONTOUR_SCHEDULE_EXTRACT_MAX_OUTPUT_TOKENS) || 12_288)
)

/** Gemini schedule 전용 행 (modetour CommonScheduleDayRow와 동등 역할) */
export type KyowontourScheduleExtractRow = {
  day: number
  title: string
  description: string
  imageKeyword: string
  routeText?: string | null
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
}

export type KyowontourScheduleExtractLlmResult = {
  rows: KyowontourScheduleExtractRow[]
  finishReason: string | null
  expectedDays: number
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null
  const t = String(v).trim()
  return t || null
}

function clampDesc(s: string, max = 300): string {
  const t = s.replace(/\r\n/g, '\n').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/**
 * 본문에서 예상 일차 수 추정: `N일차` 최댓값과 `N박 M일`의 M 중 큰 값.
 * (교원이지 HTML·텍스트 붙여넣기 공통 휴리스틱)
 */
export function inferExpectedScheduleDayCountFromKyowontourBody(body: string, durationHint?: string): number | null {
  const blob = body.slice(0, Math.min(body.length, INFER_DAY_SCAN_MAX))
  let maxDay = 0
  for (const m of blob.matchAll(/(\d+)\s*일차/g)) {
    const d = Number(m[1])
    if (d > 0 && d <= 31) maxDay = Math.max(maxDay, d)
  }
  for (const m of blob.matchAll(/(?:^|\n)\s*DAY\s*0?(\d{1,2})\b(?!\d)/gi)) {
    const d = Number(m[1])
    if (d > 0 && d <= 31) maxDay = Math.max(maxDay, d)
  }
  const combined = `${durationHint ?? ''}\n${blob}`
  const dm = combined.match(/(\d+)\s*박\s*(\d+)\s*일/)
  let fromDuration: number | null = null
  if (dm) {
    const n = Number(dm[2])
    fromDuration = Number.isFinite(n) && n > 0 ? n : null
  }
  const parts: number[] = []
  if (maxDay >= 1) parts.push(maxDay)
  if (fromDuration != null) parts.push(fromDuration)
  if (parts.length === 0) return null
  return Math.max(...parts)
}

function parseScheduleRowsFromKyowonLlmJson(schedule: unknown, expectedDays: number): KyowontourScheduleExtractRow[] {
  const rowsRaw = Array.isArray(schedule) ? schedule : []
  const byDay = new Map<number, KyowontourScheduleExtractRow>()
  for (const s of rowsRaw) {
    const rec = s as Record<string, unknown>
    const day = Number(rec.day)
    if (!day || day < 1 || day > 31) continue
    byDay.set(day, {
      day,
      title: String(rec.title ?? '').trim(),
      description: clampDesc(String(rec.description ?? '')),
      imageKeyword: String(rec.imageKeyword ?? '').trim() || `Day ${day} travel`,
      routeText: strOrNull(rec.routeText),
      hotelText: strOrNull(rec.hotelText),
      breakfastText: strOrNull(rec.breakfastText),
      lunchText: strOrNull(rec.lunchText),
      dinnerText: strOrNull(rec.dinnerText),
      mealSummaryText: strOrNull(rec.mealSummaryText),
    })
  }
  const out: KyowontourScheduleExtractRow[] = []
  for (let d = 1; d <= expectedDays; d++) {
    const row = byDay.get(d)
    if (row) out.push(row)
  }
  return out
}

function buildKyowontourScheduleOnlyPrompt(expectedDays: number, pastedBody: string): string {
  const body = clipKyowontourRegisterBodyText(pastedBody)
  return (
    `# Role: 교원이지(여행이지) 붙여넣기 — schedule[] 전용\n` +
    `출력은 JSON 객체 하나만: {"schedule":[...]} . **schedule 외 다른 키 출력 금지.**\n\n` +
    buildScheduleExtractToneBlock() +
    `\n\n` +
    `# 규칙\n` +
    `- 붙여넣은 본문의 일정표만 근거. 창작·추측 금지.\n` +
    `- **schedule 배열 길이 = 정확히 ${expectedDays}개.**\n` +
    `- **day는 1부터 ${expectedDays}까지 각각 1개.**\n` +
    `- 각 항목: day, title, description(2~4문장·300자 이내), imageKeyword(영문 짧게), routeText, ` +
    `hotelText, breakfastText, lunchText, dinnerText, mealSummaryText.\n\n` +
    `# 붙여넣기 본문\n` +
    body
  )
}

export type RunKyowontourScheduleExtractLlmOptions = {
  logLabel?: string
  skipConnectionTest?: boolean
}

/**
 * 일정 전용 Gemini 1회 호출 (모노리식). 긴 상품은 Phase 이후 청크 전략을 검토.
 */
export async function runKyowontourScheduleExtractLlm(
  pastedBody: string,
  expectedDayCount: number,
  options?: RunKyowontourScheduleExtractLlmOptions
): Promise<KyowontourScheduleExtractLlmResult> {
  if (!Number.isInteger(expectedDayCount) || expectedDayCount < 1 || expectedDayCount > 31) {
    throw new Error(`runKyowontourScheduleExtractLlm: invalid expectedDayCount=${expectedDayCount}`)
  }
  if (!options?.skipConnectionTest) {
    const conn = await testGeminiConnection()
    if (!conn.ok) {
      throw new Error(`Gemini connection failed: ${conn.error ?? 'unknown'}`)
    }
  }
  const genAI = getGenAI()
  const model = genAI.getGenerativeModel({ model: getModelName() })
  const prompt = buildKyowontourScheduleOnlyPrompt(expectedDayCount, pastedBody)
  const logLabel = options?.logLabel ?? 'kyowontour-schedule-extract'
  const result = await model.generateContent(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: KYOWONTOUR_SCHEDULE_EXTRACT_MAX_OUTPUT_TOKENS,
        ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
      },
    },
    geminiTimeoutOpts(GEMINI_GENERATE_TIMEOUT_MS)
  )
  const finishReason = result.response.candidates?.[0]?.finishReason ?? null
  const text = result.response.text() ?? ''
  const o = parseLlmJsonObject<{ schedule?: unknown }>(text, { logLabel })
  const rows = parseScheduleRowsFromKyowonLlmJson(o.schedule, expectedDayCount)
  console.info(`[kyowontour-schedule-extract] ${logLabel}`, {
    model: getModelName(),
    expectedDays: expectedDayCount,
    got: rows.length,
    finishReason,
  })
  return { rows, finishReason, expectedDays: expectedDayCount }
}

function mealsFromExtractRow(r: KyowontourScheduleExtractRow): KyowontourScheduleDayParsed['meals'] {
  return {
    breakfast: r.breakfastText ?? '',
    lunch: r.lunchText ?? '',
    dinner: r.dinnerText ?? '',
  }
}

function activitiesFromExtractRow(r: KyowontourScheduleExtractRow): string[] {
  const parts: string[] = []
  const desc = r.description.trim()
  if (desc) parts.push(desc)
  const route = (r.routeText ?? '').trim()
  if (route) parts.push(`경로: ${route}`)
  const meal = (r.mealSummaryText ?? '').trim()
  if (meal) parts.push(`식사: ${meal}`)
  return parts.length ? parts : []
}

function scheduleDayFromExtractRow(r: KyowontourScheduleExtractRow): KyowontourScheduleDayParsed {
  return {
    dayNumber: r.day,
    title: r.title || undefined,
    activities: activitiesFromExtractRow(r),
    hotel: r.hotelText?.trim() || undefined,
    meals: mealsFromExtractRow(r),
  }
}

/**
 * `register-llm` 1차 `schedule`과 일정 전용 추출 행을 일차별로 병합.
 * - 추출 행이 있으면 해당 일차는 추출 결과 우선(설명·호텔·식사).
 * - 추출이 비어 있으면 1차 일차 유지.
 */
export function mergeKyowontourScheduleWithFirstPass(
  firstPass: KyowontourScheduleDayParsed[] | null | undefined,
  extracted: KyowontourScheduleExtractRow[] | null | undefined,
  expectedDays: number
): KyowontourScheduleDayParsed[] {
  const fpBy = new Map((firstPass ?? []).map((d) => [d.dayNumber, d]))
  const exBy = new Map((extracted ?? []).map((r) => [r.day, r]))
  const out: KyowontourScheduleDayParsed[] = []
  for (let d = 1; d <= expectedDays; d++) {
    const ex = exBy.get(d)
    const fp = fpBy.get(d)
    if (ex && ex.description.trim()) {
      out.push(scheduleDayFromExtractRow(ex))
    } else if (fp) {
      out.push(fp)
    } else if (ex) {
      out.push(scheduleDayFromExtractRow(ex))
    }
  }
  return out
}
