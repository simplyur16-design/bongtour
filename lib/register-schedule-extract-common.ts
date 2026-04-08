/**
 * 공급사 공통: 붙여넣기 본문에서 일정(schedule[])만 경량 LLM으로 먼저 추출한다.
 * 풀 등록 JSON과 동시에 거대 schedule을 출력하면 MAX_TOKENS·일차 누락이 나기 쉬워 분리한다.
 */
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { buildScheduleExtractToneBlock } from '@/lib/bongtour-tone-manner-llm-ssot'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'

export const REGISTER_SCHEDULE_PASTE_MAX_CHARS = 32000

/** 일정 전용 호출 출력 상한 (10~12일·식사·호텔 필드 포함 시 여유). */
export const SCHEDULE_EXTRACT_MAX_OUTPUT_TOKENS = Math.max(
  8192,
  Math.min(65536, Number(process.env.GEMINI_SCHEDULE_EXTRACT_MAX_OUTPUT_TOKENS) || 24576)
)

export type CommonScheduleDayRow = {
  day: number
  title: string
  description: string
  imageKeyword: string
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
  const blob = pastedBody.slice(0, REGISTER_SCHEDULE_PASTE_MAX_CHARS)
  let maxDay = 0
  for (const m of blob.matchAll(/(\d+)일차/g)) {
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

function buildScheduleOnlyPrompt(expectedDays: number, pastedBody: string, hintJson: string | null): string {
  const body = pastedBody.slice(0, REGISTER_SCHEDULE_PASTE_MAX_CHARS)
  const hint =
    hintJson && hintJson.trim()
      ? `참고(부분·잘림 가능, 본문과 충돌 시 본문 우선):\n${hintJson.slice(0, 6000)}\n`
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
    `- 각 항목: day, title, description(한국어 1~2문장·**220자 이내**), imageKeyword(영문 장소명 짧게), ` +
    `hotelText, breakfastText, lunchText, dinnerText, mealSummaryText.\n` +
    `- description 은 요약만. 원문 장문 관광·안내·펼침 블록을 그대로 복사하지 말 것.\n\n` +
    hint +
    `# 붙여넣기 본문\n` +
    body
  )
}

export type ScheduleExtractLlmResult = {
  rows: CommonScheduleDayRow[]
  finishReason: string | null
  expectedDays: number
}

export async function runScheduleExtractLlm(
  model: ReturnType<ReturnType<typeof getGenAI>['getGenerativeModel']>,
  pastedBody: string,
  expectedDays: number,
  opts: { logLabel: string; hintScheduleJson?: string | null }
): Promise<ScheduleExtractLlmResult> {
  const hint = opts.hintScheduleJson ?? null
  const prompt = buildScheduleOnlyPrompt(expectedDays, pastedBody, hint)
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
  const rowsRaw = Array.isArray(o.schedule) ? o.schedule : []
  const byDay = new Map<number, CommonScheduleDayRow>()
  for (const s of rowsRaw) {
    const rec = s as Record<string, unknown>
    const day = Number(rec.day)
    if (!day || day < 1) continue
    byDay.set(day, {
      day,
      title: String(rec.title ?? '').trim(),
      description: String(rec.description ?? '').trim(),
      imageKeyword: String(rec.imageKeyword ?? '').trim() || `Day ${day} travel`,
      hotelText: strOrNull(rec.hotelText),
      breakfastText: strOrNull(rec.breakfastText),
      lunchText: strOrNull(rec.lunchText),
      dinnerText: strOrNull(rec.dinnerText),
      mealSummaryText: strOrNull(rec.mealSummaryText),
    })
  }
  const out: CommonScheduleDayRow[] = []
  for (let d = 1; d <= expectedDays; d++) {
    const row = byDay.get(d)
    if (row) out.push(row)
  }
  console.info(`[register-schedule-extract] ${opts.logLabel}`, {
    model: getModelName(),
    expectedDays,
    got: out.length,
    finishReason: fr,
  })
  if (fr === 'MAX_TOKENS') {
    console.warn(`[register-schedule-extract] ${opts.logLabel} finishReason=MAX_TOKENS`)
  }
  return { rows: out, finishReason: fr, expectedDays }
}
