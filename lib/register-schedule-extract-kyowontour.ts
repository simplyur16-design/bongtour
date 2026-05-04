/**
 * [kyowontour] 붙여넣기 본문에서 일정(schedule[])만 경량 LLM으로 먼저 추출한다.
 * 풀 등록 JSON과 동시에 거대 schedule을 출력하면 MAX_TOKENS·일차 누락이 나기 쉬워 분리한다.
 * (공급사 독립화: `register-schedule-extract-common`과 동일 로직·프롬프트 보존.)
 */
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { buildScheduleExtractToneBlock } from '@/lib/bongtour-tone-manner-llm-ssot'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'
import { extractRelevantSections } from '@/lib/paste-relevant-sections'

export const REGISTER_SCHEDULE_PASTE_MAX_CHARS = 32000

/** 일차 개수 정규식만 — 본문이 길어도 끝 일차가 잘리지 않게 상한만 둠(메모리·정규 비용) */
const INFER_DAY_COUNT_SCAN_MAX = 500_000

/**
 * 일정 전용 Gemini 입력: 전체 장문을 그대로 넣으면 입력 토큰·지연·불안정(응답 끊김) 위험이 커진다.
 * 길이가 상한을 넘으면 `extractRelevantSections`로 일정·가격 등 **관련 줄 위주**로 잘라 넣는다(효율적 부분 추출).
 */
export function buildScheduleExtractInputForLlm(pastedBody: string): string {
  const raw = pastedBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!raw) return ''
  if (raw.length <= REGISTER_SCHEDULE_PASTE_MAX_CHARS) return raw
  return extractRelevantSections(raw, REGISTER_SCHEDULE_PASTE_MAX_CHARS)
}

/** 일정 전용 호출 출력 상한 (10~12일·식사·호텔 필드 포함 시 여유). */
export const SCHEDULE_EXTRACT_MAX_OUTPUT_TOKENS = Math.max(
  8192,
  Math.min(65536, Number(process.env.GEMINI_SCHEDULE_EXTRACT_MAX_OUTPUT_TOKENS) || 24576)
)

function parseEnvIntInRange(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = raw?.trim() ? Number(raw) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

/** 이 일수 이상이면 일차 헤더 분할 + 일차별 병렬(배치) 추출을 시도한다. */
const SCHEDULE_CHUNK_DAY_THRESHOLD = parseEnvIntInRange(
  process.env.GEMINI_SCHEDULE_CHUNK_DAY_THRESHOLD,
  8,
  2,
  31
)

/** 일차별 동시 Gemini 호출 상한(과다 병렬·레이트 리스크 완화) */
const SCHEDULE_CHUNK_CONCURRENCY = parseEnvIntInRange(process.env.GEMINI_SCHEDULE_CHUNK_CONCURRENCY, 3, 1, 8)

/** 일차 블록 하나당 LLM 입력 상한(토큰·불안정 방지) */
const SCHEDULE_CHUNK_SINGLE_DAY_MAX_CHARS = parseEnvIntInRange(
  process.env.GEMINI_SCHEDULE_CHUNK_SINGLE_DAY_MAX_CHARS,
  16_000,
  4000,
  48_000
)

/** 일차별 출력 토큰(한 일차만 출력하므로 전체 일정 호출보다 작게) */
const SCHEDULE_CHUNK_PER_DAY_MAX_OUTPUT_TOKENS = parseEnvIntInRange(
  process.env.GEMINI_SCHEDULE_CHUNK_PER_DAY_MAX_OUTPUT_TOKENS,
  8192,
  2048,
  16_384
)

/** 일차 description 하드 상한(LLM이 길게 써도 서버에서 잘림). */
const SCHEDULE_EXTRACT_DESCRIPTION_MAX_CHARS = parseEnvIntInRange(
  process.env.GEMINI_SCHEDULE_EXTRACT_DESCRIPTION_MAX_CHARS,
  300,
  120,
  600
)

function clampScheduleDescriptionText(s: string): string {
  const t = s.replace(/\r\n/g, '\n').trim()
  if (t.length <= SCHEDULE_EXTRACT_DESCRIPTION_MAX_CHARS) return t
  return `${t.slice(0, SCHEDULE_EXTRACT_DESCRIPTION_MAX_CHARS - 1)}…`
}

export type CommonScheduleDayRow = {
  day: number
  title: string
  description: string
  imageKeyword: string
  routeText?: string | null
  hotelText: string | null
  breakfastText: string | null
  lunchText: string | null
  dinnerText: string | null
  mealSummaryText: string | null
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null
  const t = String(v).trim()
  return t || null
}

/**
 * 본문 `N일차` 최댓값과 `N박 M일`의 M(여행일 수) 중 **더 큰 값**을 사용한다.
 * (일차 헤더 누락·박/일만 있는 경우 등 혼합 대응)
 */
export function inferExpectedScheduleDayCountFromPaste(pastedBody: string, durationStr: string): number | null {
  const blob = pastedBody.slice(0, Math.min(pastedBody.length, INFER_DAY_COUNT_SCAN_MAX))
  let maxDay = 0
  for (const m of blob.matchAll(/(\d+)일차/g)) {
    const d = Number(m[1])
    if (d > 0 && d <= 31) maxDay = Math.max(maxDay, d)
  }
  /** `DAY 01`~`DAY 12` 만 있고 `N일차` 표기가 없는 붙여넣기(일부 모두투어·PDF)도 일수 추정 */
  for (const m of blob.matchAll(/(?:^|\n)\s*DAY\s*0?(\d{1,2})\b(?!\d)/gi)) {
    const d = Number(m[1])
    if (d > 0 && d <= 31) maxDay = Math.max(maxDay, d)
  }
  const combined = `${durationStr}\n${blob}`
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

/**
 * `N일차` / `DAY N` 헤더로 본문을 일차별 텍스트로 분할한다.
 * 헤더가 없거나 너무 적으면 null (상위에서 일괄 추출로 폴백).
 */
export function splitPastedBodyByDayHeaders(pastedBody: string): Map<number, string> | null {
  const normalized = pastedBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const headers: { day: number; start: number }[] = []
  const re = /(?:^|\n)\s*(\d{1,2})\s*일차\b|(?:^|\n)\s*DAY\s*0?(\d{1,2})\b(?!\d)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(normalized)) !== null) {
    const day = Number(m[1] ?? m[2])
    if (day >= 1 && day <= 31) headers.push({ day, start: m.index })
  }
  if (headers.length === 0) return null
  headers.sort((a, b) => a.start - b.start)
  const map = new Map<number, string>()
  for (let i = 0; i < headers.length; i++) {
    const { day, start } = headers[i]!
    const end = i + 1 < headers.length ? headers[i + 1]!.start : normalized.length
    const chunk = normalized.slice(start, end)
    const prev = map.get(day)
    map.set(day, prev ? `${prev}\n${chunk}` : chunk)
  }
  const first = headers[0]!
  if (first.day > 1 && first.start > 0 && !map.has(1)) {
    const preamble = normalized.slice(0, first.start).trim()
    if (preamble.length >= 12) map.set(1, preamble)
  }
  return map
}

function dayMapCoversExpectedRange(dayMap: Map<number, string>, expectedDays: number): boolean {
  for (let d = 1; d <= expectedDays; d++) {
    const t = (dayMap.get(d) ?? '').trim()
    if (t.length < 6) return false
  }
  return true
}

function parseScheduleRowsFromLlmJson(
  schedule: unknown,
  opts: { expectedDays: number; strictDay: number | null }
): CommonScheduleDayRow[] {
  const rowsRaw = Array.isArray(schedule) ? schedule : []
  const byDay = new Map<number, CommonScheduleDayRow>()
  for (const s of rowsRaw) {
    const rec = s as Record<string, unknown>
    const day = Number(rec.day)
    if (!day || day < 1) continue
    byDay.set(day, {
      day,
      title: String(rec.title ?? '').trim(),
      description: clampScheduleDescriptionText(String(rec.description ?? '')),
      imageKeyword: String(rec.imageKeyword ?? '').trim() || `Day ${day} travel`,
      routeText: strOrNull(rec.routeText),
      hotelText: strOrNull(rec.hotelText),
      breakfastText: strOrNull(rec.breakfastText),
      lunchText: strOrNull(rec.lunchText),
      dinnerText: strOrNull(rec.dinnerText),
      mealSummaryText: strOrNull(rec.mealSummaryText),
    })
  }
  if (opts.strictDay != null) {
    const want = opts.strictDay
    let row = byDay.get(want)
    if (!row && byDay.size === 1) {
      row = [...byDay.values()][0]!
    }
    if (row) return [{ ...row, day: want }]
    return []
  }
  const out: CommonScheduleDayRow[] = []
  for (let d = 1; d <= opts.expectedDays; d++) {
    const row = byDay.get(d)
    if (row) out.push(row)
  }
  return out
}

/** 풀 등록 프롬프트 JSON 예시의 schedule 배열을 []로 바꿔 출력 토큰·모델 복사를 줄인다. */
export function replaceRegisterPromptScheduleJsonWithEmptyArray(registerPrompt: string): string {
  const idx = registerPrompt.indexOf('"schedule":')
  if (idx === -1) return registerPrompt
  const j = registerPrompt.indexOf('[', idx + 11)
  if (j === -1) return registerPrompt
  let depth = 0
  let inQuote = false
  let escape = false
  for (let k = j; k < registerPrompt.length; k++) {
    const c = registerPrompt[k]
    if (inQuote) {
      if (escape) escape = false
      else if (c === '\\') escape = true
      else if (c === '"') inQuote = false
      continue
    }
    if (c === '"') {
      inQuote = true
      continue
    }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) {
        return registerPrompt.slice(0, j) + '[]' + registerPrompt.slice(k + 1)
      }
    }
  }
  return registerPrompt
}

export function registerPromptWithScheduleEmptyForConfirm(registerPrompt: string): string {
  const body = replaceRegisterPromptScheduleJsonWithEmptyArray(registerPrompt)
  return (
    `# [최우선 — JSON 출력]\n` +
    `- 응답 JSON의 "schedule" 키는 반드시 빈 배열 []만 출력한다. 일차별 일정은 서버가 별도 단계에서 이미 추출·병합한다.\n` +
    `- 아래 JSON 예시의 schedule을 채우지 말 것.\n\n` +
    body
  )
}

function buildScheduleOnlyPrompt(
  expectedDays: number,
  pastedBody: string,
  hintJson: string | null,
  addendum: string | null
): string {
  const body = buildScheduleExtractInputForLlm(pastedBody)
  const hint =
    hintJson && hintJson.trim()
      ? `참고(부분·잘림 가능, 본문과 충돌 시 본문 우선):\n${hintJson.slice(0, 6000)}\n`
      : ''
  const add =
    addendum && addendum.trim()
      ? `# 일정 선추출 보강(공급사 전용 지시가 있을 때만)\n${addendum.trim()}\n\n`
      : ''
  return (
    `# Role: 여행 상품 붙여넣기 — schedule[] 전용 (공급사 무관)\n` +
    `출력은 JSON 객체 하나만: {"schedule":[...]} . 다른 키 금지.\n\n` +
    buildScheduleExtractToneBlock() +
    `\n` +
    `# 규칙\n` +
    `- 붙여넣은 본문의 일정표(1일차~N일차 등)만 근거로 작성. 창작·추측 금지.\n` +
    `- **schedule 배열 길이 = 정확히 ${expectedDays}개.**\n` +
    `- **day는 1부터 ${expectedDays}까지 각각 1개씩, 중복·누락 금지.**\n` +
    `- 마지막 일차(귀국·출국·기내박·숙박 없음)까지 반드시 포함.\n` +
    `- 각 항목: day, title, description(한국어 **2~4문장·300자 이내**), imageKeyword(영문 장소명 짧게), routeText, ` +
    `hotelText, breakfastText, lunchText, dinnerText, mealSummaryText.\n` +
    `- routeText: 그날 방문 도시·장소를 본문 순서 그대로 ' - ' (공백-하이픈-공백)로 연결한 한 줄 경로. 한국어로 작성. 본문에 한국어 지명이 있으면 그대로 사용. 영문 지명만 있으면 한국어 음역 또는 한국에서 통용되는 한국어 표기. 예: "인천 - 부다페스트 - 나지카니자", "인천 - 아디스아바바 - 빅토리아 폭포", "JFK공항 - 뉴욕 - 덤보 - 브루클린브릿지(조망)", "스플리트 - 두브로브니크". [조망], [차창관광], [외부관람], [선택관광] 태그는 (조망), (차창), (외부관람), (선택관광)로 보존. 빈 일정이면 null.\n` +
    `- description: 해당 일차의 이동·관광·식사·숙박 흐름을 **짧은 문어체**로 요약. 원문 장문·HTML을 **통째로 복사**하지 말 것.\n` +
    `- 방문지가 많으면 **이름 위주로 묶어** 쓰고, 식사·호텔 디테일은 가능하면 meal·hotel 필드에 둔다.\n\n` +
    hint +
    add +
    `# 붙여넣기 본문\n` +
    body
  )
}

function buildScheduleOnlyPromptForSingleDay(
  day: number,
  dayBlob: string,
  hintJson: string | null,
  addendum: string | null
): string {
  const raw = dayBlob.trim()
  const body =
    raw.length <= SCHEDULE_CHUNK_SINGLE_DAY_MAX_CHARS ? raw : raw.slice(0, SCHEDULE_CHUNK_SINGLE_DAY_MAX_CHARS)
  const hint =
    hintJson && hintJson.trim()
      ? `참고(부분·잘림 가능, 본문과 충돌 시 본문 우선):\n${hintJson.slice(0, 2000)}\n`
      : ''
  const add =
    addendum && addendum.trim()
      ? `# 일정 선추출 보강(공급사 전용 지시가 있을 때만)\n${addendum.trim()}\n\n`
      : ''
  return (
    `# Role: 여행 상품 붙여넣기 — schedule[] 전용 (공급사 무관)\n` +
    `출력은 JSON 객체 하나만: {"schedule":[...]} . 다른 키 금지.\n\n` +
    buildScheduleExtractToneBlock() +
    `\n` +
    `# 규칙\n` +
    `- 아래 본문은 **제${day}일차** 구간만 포함한다.\n` +
    `- **schedule 배열 길이 = 정확히 1개.** day=${day} 인 항목만.\n` +
    `- **day 필드는 반드시 정수 ${day}**\n` +
    `- 각 항목: day, title, description(한국어 **2~4문장·300자 이내**), imageKeyword(영문 장소명 짧게), routeText, ` +
    `hotelText, breakfastText, lunchText, dinnerText, mealSummaryText.\n` +
    `- routeText: 그날 방문 도시·장소를 본문 순서 그대로 ' - ' (공백-하이픈-공백)로 연결한 한 줄 경로. 한국어로 작성. 본문에 한국어 지명이 있으면 그대로 사용. 영문 지명만 있으면 한국어 음역 또는 한국에서 통용되는 한국어 표기. 예: "인천 - 부다페스트 - 나지카니자", "인천 - 아디스아바바 - 빅토리아 폭포", "JFK공항 - 뉴욕 - 덤보 - 브루클린브릿지(조망)", "스플리트 - 두브로브니크". [조망], [차창관광], [외부관람], [선택관광] 태그는 (조망), (차창), (외부관람), (선택관광)로 보존. 빈 일정이면 null.\n` +
    `- description: 해당 일차를 **짧게** 요약. 원문 복붙·장황한 나열 금지.\n\n` +
    hint +
    add +
    `# 붙여넣기 본문 (제${day}일차)\n` +
    body
  )
}

export type ScheduleExtractLlmResult = {
  rows: CommonScheduleDayRow[]
  finishReason: string | null
  expectedDays: number
}

async function runScheduleExtractLlmMonolithic(
  model: ReturnType<ReturnType<typeof getGenAI>['getGenerativeModel']>,
  pastedBody: string,
  expectedDays: number,
  opts: { logLabel: string; hintScheduleJson?: string | null; scheduleExtractAddendum?: string | null }
): Promise<ScheduleExtractLlmResult> {
  const hint = opts.hintScheduleJson ?? null
  const addendum = opts.scheduleExtractAddendum ?? null
  const prompt = buildScheduleOnlyPrompt(expectedDays, pastedBody, hint, addendum)
  const result = await model.generateContent(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: SCHEDULE_EXTRACT_MAX_OUTPUT_TOKENS,
        ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
      },
    },
    geminiTimeoutOpts()
  )
  const fr = result.response.candidates?.[0]?.finishReason ?? null
  const text = result.response.text()
  const o = parseLlmJsonObject<{ schedule?: unknown }>(text, { logLabel: opts.logLabel })
  const out = parseScheduleRowsFromLlmJson(o.schedule, { expectedDays, strictDay: null })
  console.info(`[register-schedule-extract] ${opts.logLabel}`, {
    model: getModelName(),
    mode: 'monolithic',
    expectedDays,
    got: out.length,
    finishReason: fr,
  })
  if (fr === 'MAX_TOKENS') {
    console.warn(`[register-schedule-extract] ${opts.logLabel} finishReason=MAX_TOKENS`)
  }
  return { rows: out, finishReason: fr, expectedDays }
}

async function runScheduleExtractLlmChunkedByDay(
  model: ReturnType<ReturnType<typeof getGenAI>['getGenerativeModel']>,
  pastedBody: string,
  expectedDays: number,
  dayMap: Map<number, string>,
  opts: { logLabel: string; hintScheduleJson?: string | null; scheduleExtractAddendum?: string | null }
): Promise<ScheduleExtractLlmResult> {
  const hint = opts.hintScheduleJson ?? null
  const addendum = opts.scheduleExtractAddendum ?? null
  const allRows: CommonScheduleDayRow[] = []
  let worstFinish: string | null = null
  const days = Array.from({ length: expectedDays }, (_, i) => i + 1)
  for (let i = 0; i < days.length; i += SCHEDULE_CHUNK_CONCURRENCY) {
    const batch = days.slice(i, i + SCHEDULE_CHUNK_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (day) => {
        const blob = (dayMap.get(day) ?? '').trim()
        const prompt = buildScheduleOnlyPromptForSingleDay(day, blob, hint, addendum)
        const result = await model.generateContent(
          {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: SCHEDULE_CHUNK_PER_DAY_MAX_OUTPUT_TOKENS,
              ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
            },
          },
          geminiTimeoutOpts()
        )
        const fr = result.response.candidates?.[0]?.finishReason ?? null
        const text = result.response.text()
        const o = parseLlmJsonObject<{ schedule?: unknown }>(text, {
          logLabel: `${opts.logLabel}-day${day}`,
        })
        const rows = parseScheduleRowsFromLlmJson(o.schedule, { expectedDays: 1, strictDay: day })
        let row = rows[0] ?? null
        if (row) row = { ...row, day }
        console.info(`[register-schedule-extract] ${opts.logLabel}-day${day}`, {
          model: getModelName(),
          mode: 'chunk',
          gotRow: Boolean(row),
          finishReason: fr,
        })
        return { row, fr }
      })
    )
    for (const { row, fr } of batchResults) {
      if (fr && fr !== 'STOP') worstFinish = fr
      if (row) allRows.push(row)
    }
  }
  allRows.sort((a, b) => a.day - b.day)
  console.info(`[register-schedule-extract] ${opts.logLabel}`, {
    model: getModelName(),
    mode: 'chunked-by-day',
    expectedDays,
    got: allRows.length,
    concurrency: SCHEDULE_CHUNK_CONCURRENCY,
    finishReason: worstFinish,
  })
  return { rows: allRows, finishReason: worstFinish, expectedDays }
}

export async function runScheduleExtractLlm(
  model: ReturnType<ReturnType<typeof getGenAI>['getGenerativeModel']>,
  pastedBody: string,
  expectedDays: number,
  opts: { logLabel: string; hintScheduleJson?: string | null; scheduleExtractAddendum?: string | null }
): Promise<ScheduleExtractLlmResult> {
  if (expectedDays >= SCHEDULE_CHUNK_DAY_THRESHOLD) {
    const dayMap = splitPastedBodyByDayHeaders(pastedBody)
    if (dayMap && dayMapCoversExpectedRange(dayMap, expectedDays)) {
      return runScheduleExtractLlmChunkedByDay(model, pastedBody, expectedDays, dayMap, opts)
    }
    console.info(`[register-schedule-extract] ${opts.logLabel} chunked skip`, {
      reason: dayMap ? 'day_map_incomplete' : 'no_day_headers',
      expectedDays,
    })
  }
  return runScheduleExtractLlmMonolithic(model, pastedBody, expectedDays, opts)
}

/**
 * 일정 선추출(`runScheduleExtractLlm`) 행이 있으면 **일차별로** 메인 JSON `schedule`보다 우선한다.
 * 선추출이 일수만큼 안 나와도 기존처럼 전부 버리지 않고, 나온 일차는 선추출 문장을 쓴다.
 */
export function mergeScheduleWithFirstPassPreferExtractRows(
  rawSchedule: unknown,
  firstPassRows: CommonScheduleDayRow[] | null | undefined,
  expectedDays: number | null
): unknown[] | null {
  if (!firstPassRows?.length || expectedDays == null || expectedDays < 1) return null
  const mainList = Array.isArray(rawSchedule) ? rawSchedule : []
  const fpByDay = new Map(firstPassRows.map((r) => [r.day, r]))
  const mainByDay = new Map<number, Record<string, unknown>>()
  for (const s of mainList) {
    const rec = s as Record<string, unknown>
    const d = Number(rec.day) || 0
    if (d > 0) mainByDay.set(d, rec)
  }
  const out: Record<string, unknown>[] = []
  for (let d = 1; d <= expectedDays; d++) {
    const fp = fpByDay.get(d)
    const main = mainByDay.get(d)
    if (fp && main) {
      out.push({
        ...main,
        day: fp.day,
        title: fp.title.trim() || String(main.title ?? '').trim(),
        description: fp.description.trim() || String(main.description ?? '').trim(),
        imageKeyword:
          fp.imageKeyword.trim() || String(main.imageKeyword ?? '').trim() || `Day ${d} travel`,
        hotelText: fp.hotelText ?? main.hotelText ?? null,
        breakfastText: fp.breakfastText ?? main.breakfastText ?? null,
        lunchText: fp.lunchText ?? main.lunchText ?? null,
        dinnerText: fp.dinnerText ?? main.dinnerText ?? null,
        mealSummaryText: fp.mealSummaryText ?? main.mealSummaryText ?? null,
        routeText: strOrNull(fp.routeText) ?? strOrNull(main.routeText),
      })
    } else if (fp) {
      out.push({
        day: fp.day,
        title: fp.title,
        description: fp.description,
        imageKeyword: fp.imageKeyword,
        routeText: strOrNull(fp.routeText),
        hotelText: fp.hotelText,
        breakfastText: fp.breakfastText,
        lunchText: fp.lunchText,
        dinnerText: fp.dinnerText,
        mealSummaryText: fp.mealSummaryText,
      })
    } else if (main) {
      out.push(main)
    }
  }
  return out.length ? out : null
}
