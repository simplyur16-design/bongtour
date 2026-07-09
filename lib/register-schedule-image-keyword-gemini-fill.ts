/**
 * routeText 규칙·POI 사전 후에도 imageKeyword가 비는 일차 — Gemini로 영문 랜드마크 1·2순위 생성.
 * 자유일정 일차 — Gemini 추천 일정 생성 후 imageKeyword·imageKeyword2 채움.
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: manifest
 */
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'
import { classifyModetourScheduleCardDayKind, isModetourDomesticHubToken } from '@/lib/modetour-schedule-image-keyword'
import { isScheduleDomesticHubOnlyRouteText } from '@/lib/schedule-image-keyword-adjacent-poi'
import {
  REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK,
  REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK,
} from '@/lib/register-schedule-image-keyword-prompt'
import {
  isRegisterScheduleFreeLeisureDay,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  applyRegisterScheduleImageKeywordsBySupplier,
  type RegisterScheduleImageKeywordApplyRow,
} from '@/lib/register-schedule-image-keywords-apply'

export type ScheduleImageKeywordGeminiRow = RegisterScheduleImageKeywordApplyRow

const GEMINI_FILL_TIMEOUT_MS = Math.max(
  12_000,
  Number(process.env.REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI_TIMEOUT_MS) || 22_000,
)

function buildScheduleRowHaystack(row: ScheduleImageKeywordGeminiRow): string {
  return [row.title, row.description, row.routeText]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

/** 자유일정 일차 — routeText 규칙 후 imageKeyword가 비었을 때 Gemini 대상 */
export function scheduleFreeLeisureDaysMissingImageKeyword(
  rows: readonly ScheduleImageKeywordGeminiRow[],
): number[] {
  const out: number[] = []
  for (const row of rows) {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) continue
    if (String(row.imageKeyword ?? '').trim()) continue
    const hay = buildScheduleRowHaystack(row)
    if (!hay.trim()) continue
    if (!isRegisterScheduleFreeLeisureDay(hay)) continue
    out.push(day)
  }
  return out
}

/** 규칙 적용 후 imageKeyword가 비었지만 일정 텍스트는 있는 일차 */
export function scheduleDaysMissingImageKeywordAfterRules(
  rows: readonly ScheduleImageKeywordGeminiRow[],
): number[] {
  const sorted = rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const out: number[] = []
  for (const row of sorted) {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) continue
    if (String(row.imageKeyword ?? '').trim()) continue
    const hay = buildScheduleRowHaystack(row)
    if (!hay.trim()) continue
    if (isRegisterScheduleFreeLeisureDay(hay)) {
      out.push(day)
      continue
    }
    const routeText = String(row.routeText ?? '').trim()
    if (!routeText) continue
    /** 출발·귀국 인천-only 등 — 규칙이 의도적으로 비운 슬롯. Gemini가 타일 관광명으로 채우면 SSOT 붕괴 */
    // REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: domestic-hub-only·movement·return — Gemini skip
    if (isScheduleDomesticHubOnlyRouteText(routeText, isModetourDomesticHubToken)) continue
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, hay)
    if (dayKind === 'movement' || dayKind === 'return_home') continue
    out.push(day)
  }
  return out
}

function countForeignRouteTextSegments(routeText: string | null | undefined): number {
  return splitRouteTextPlaceSegments(routeText)
    .map((s) => String(s ?? '').trim())
    .filter((s) => s.length >= 2 && !isModetourDomesticHubToken(s)).length
}

/**
 * 관광 일차 — kw1은 있는데 kw2만 비었고 routeText에 2+ 해외 세그먼트(사전 미매핑 포함).
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: manifest
 */
export function scheduleDaysMissingImageKeyword2AfterRules(
  rows: readonly ScheduleImageKeywordGeminiRow[],
): number[] {
  const sorted = rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const out: number[] = []
  for (const row of sorted) {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) continue
    if (!String(row.imageKeyword ?? '').trim()) continue
    if (String(row.imageKeyword2 ?? '').trim()) continue
    if (!String(row.routeText ?? '').trim()) continue
    if (countForeignRouteTextSegments(row.routeText) < 2) continue
    const haystack = [row.title, row.description, row.routeText].filter(Boolean).join('\n')
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, haystack)
    if (dayKind !== 'tourism') continue
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

${REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK}

${REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK}

Read each day's routeText segments in visit order (A - B - C - D). For each segment, resolve the standard English proper name — do not translate literally.

Days to fill:
${lines.join('\n')}

Return JSON only:
{"schedule":[{"day":1,"imageKeyword":"First landmark EN","imageKeyword2":null}]}

imageKeyword2 must be a second distinct landmark on tourism days when routeText lists 2+ spots; null on departure/return flight days.`
}

export function buildFreeLeisureDayGeminiPrompt(
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
      const desc = String(r.description ?? '').trim().slice(0, 320)
      return `- Day ${r.day}: title="${title || '(none)'}" routeText="${rt}"${desc ? ` description="${desc}"` : ''}`
    })

  return `This package tour has free-leisure schedule day(s). For each day below:
1) Propose a realistic half-day or full-day recommended sightseeing route (2-4 landmark stops in visit order).
2) Resolve Pexels English landmark proper nouns for imageKeyword (1 required) and imageKeyword2 (second distinct landmark when 2+ stops).

Product title: ${opts.productTitle?.trim() || 'unknown'}
Destination: ${opts.productDestination?.trim() || 'unknown'}

${REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK}

${REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK}

Free-leisure days to fill:
${lines.join('\n')}

Return JSON only:
{"schedule":[{"day":6,"recommendedRoute":"Yas Island - Ferrari World - SeaWorld","imageKeyword":"Ferrari World","imageKeyword2":"SeaWorld Abu Dhabi"}]}

recommendedRoute is for operator review only; imageKeyword/imageKeyword2 are required standard English proper names (not literal translations).`
}

async function fillFreeLeisureDaysWithGemini<
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
  const daysToFill = scheduleFreeLeisureDaysMissingImageKeyword(rows)
  if (!daysToFill.length) return rows

  const logLabel = opts.logLabel ?? 'register-schedule-free-leisure-gemini'
  try {
    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({ model: getModelName() })
    const prompt = buildFreeLeisureDayGeminiPrompt(rows, {
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
    console.warn(`[${logLabel}] free-leisure gemini fill failed`, e)
    return rows
  }
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
    const kw2raw = o.imageKeyword2
    const kw2 =
      kw2raw == null || String(kw2raw).trim() === '' ? null : String(kw2raw).trim()
    if (!kw && !kw2) continue
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

  const daysToFill = [
    ...new Set([
      ...scheduleDaysMissingImageKeywordAfterRules(rows),
      ...scheduleDaysMissingImageKeyword2AfterRules(rows),
    ]),
  ]
  if (!daysToFill.length) {
    return fillFreeLeisureDaysWithGemini(rows, opts)
  }

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
    if (!byDay.size) return fillFreeLeisureDaysWithGemini(rows, opts)

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

    const withRules = applyRegisterScheduleImageKeywordsBySupplier<T>(merged, {
      supplierKey: opts.supplierKey,
      productDestination: opts.productDestination ?? null,
      productTitle: opts.productTitle ?? null,
    })
    return fillFreeLeisureDaysWithGemini(withRules, opts)
  } catch (e) {
    console.warn(`[${logLabel}] gemini fill failed`, e)
    return fillFreeLeisureDaysWithGemini(rows, opts)
  }
}
