/**
 * routeText 규칙·POI 사전 후에도 imageKeyword가 비는 일차 — Gemini로 영문 랜드마크 1·2순위 생성.
 * 지역별 ROI 테이블 대신 일정 텍스트(A - B - C)를 Gemini에 넘긴다.
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: manifest
 */
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'
import { REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK } from '@/lib/register-schedule-image-keyword-prompt'
import {
  applyRegisterScheduleImageKeywordsBySupplier,
  type RegisterScheduleImageKeywordApplyRow,
} from '@/lib/register-schedule-image-keywords-apply'

export type ScheduleImageKeywordGeminiRow = RegisterScheduleImageKeywordApplyRow

const GEMINI_FILL_TIMEOUT_MS = Math.max(
  12_000,
  Number(process.env.REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI_TIMEOUT_MS) || 22_000,
)

/** 규칙 적용 후 imageKeyword가 비었지만 일정 텍스트는 있는 일차 */
export function scheduleDaysMissingImageKeywordAfterRules(
  rows: readonly ScheduleImageKeywordGeminiRow[],
): number[] {
  const out: number[] = []
  for (const row of rows) {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) continue
    if (String(row.imageKeyword ?? '').trim()) continue
    const hay = [row.title, row.description, row.routeText]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .join('\n')
    if (!hay.trim()) continue
    if (!String(row.routeText ?? '').trim()) continue
    out.push(day)
  }
  return out
}

export function buildScheduleImageKeywordGeminiPrompt(
  rows: readonly ScheduleImageKeywordGeminiRow[],
  opts: {
    productDestination?: string | null
    productTitle?: string | null
    daysToFill: readonly number[]
  },
): string {
  const daySet = new Set(opts.daysToFill)
  const lines = [...rows]
    .filter((r) => daySet.has(Number(r.day)))
    .sort((a, b) => Number(a.day) - Number(b.day))
    .map((r) => {
      const rt = String(r.routeText ?? '').trim() || '(none)'
      const title = String(r.title ?? '').trim()
      const desc = String(r.description ?? '').trim().slice(0, 240)
      return `- Day ${r.day}: routeText="${rt}"${title ? ` title="${title}"` : ''}${desc ? ` description="${desc}"` : ''}`
    })

  return `Fill Pexels English landmark keywords for a package tour schedule.

Product title: ${opts.productTitle?.trim() || 'unknown'}
Destination: ${opts.productDestination?.trim() || 'unknown'}

${REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK}

Read each day's routeText segments in visit order (A - B - C - D). Pick 1 or 2 distinct landmark proper nouns in English.

Days to fill:
${lines.join('\n')}

Return JSON only:
{"schedule":[{"day":1,"imageKeyword":"First landmark EN","imageKeyword2":null}]}

imageKeyword2 must be a second distinct landmark on tourism days when routeText lists 2+ spots; null on departure/return flight days.`
}

function parseGeminiScheduleKeywordRows(raw: unknown): Map<number, { kw: string; kw2: string | null }> {
  const out = new Map<number, { kw: string; kw2: string | null }>()
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const day = Number(o.day)
    if (!Number.isFinite(day) || day < 1) continue
    const kw = String(o.imageKeyword ?? '').trim()
    if (!kw) continue
    const kw2raw = o.imageKeyword2
    const kw2 =
      kw2raw == null || String(kw2raw).trim() === '' ? null : String(kw2raw).trim()
    out.set(day, { kw, kw2 })
  }
  return out
}

/**
 * 규칙 후 빈 imageKeyword 일차만 Gemini로 채운 뒤 공급사 규칙을 다시 적용(검증·reconcile).
 */
export async function fillRegisterScheduleImageKeywordsWithGeminiIfNeeded<
  T extends RegisterScheduleImageKeywordApplyRow,
>(
  rows: T[],
  opts: {
    supplierKey: string
    productDestination?: string | null
    productTitle?: string | null
    logLabel?: string
  },
): Promise<T[]> {
  if (!rows.length) return rows
  if (process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI === '1') return rows

  const daysToFill = scheduleDaysMissingImageKeywordAfterRules(rows)
  if (!daysToFill.length) return rows

  const logLabel = opts.logLabel ?? 'register-schedule-image-keyword-gemini'
  try {
    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({ model: getModelName() })
    const prompt = buildScheduleImageKeywordGeminiPrompt(rows, {
      productDestination: opts.productDestination ?? null,
      productTitle: opts.productTitle ?? null,
      daysToFill,
    })
    const result = await model.generateContent(
      { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
      geminiTimeoutOpts(GEMINI_FILL_TIMEOUT_MS),
    )
    const text = result.response.text()
    const parsed = parseLlmJsonObject<{ schedule?: unknown }>(text, { logLabel })
    const byDay = parseGeminiScheduleKeywordRows(parsed.schedule)
    if (!byDay.size) return rows

    const merged = rows.map((row) => {
      const day = Number(row.day)
      const g = byDay.get(day)
      if (!g) return row
      const existingKw = String(row.imageKeyword ?? '').trim()
      const existingKw2 = String(row.imageKeyword2 ?? '').trim()
      return {
        ...row,
        imageKeyword: existingKw || g.kw,
        imageKeyword2: existingKw2 || g.kw2,
      }
    })

    return applyRegisterScheduleImageKeywordsBySupplier<T>(merged, {
      supplierKey: opts.supplierKey,
      productDestination: opts.productDestination ?? null,
      productTitle: opts.productTitle ?? null,
    })
  } catch (e) {
    console.warn(`[${logLabel}] gemini fill failed`, e)
    return rows
  }
}
