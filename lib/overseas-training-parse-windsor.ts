import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import {
  TRAINING_AUDIENCE_VALUES,
  TRAINING_CATEGORY_VALUES,
  type TrainingAudience,
  type TrainingCategory,
} from '@/lib/overseas-training-taxonomy'
import {
  WINDSOR_PREP_SECTION_TITLES,
  extractScheduleDaysFromProgramBody,
  splitWindsorPasteForTraining,
} from '@/lib/overseas-training-windsor-sections'

export type WindsorPasteParseResult = {
  originalTitle: string | null
  trainingDescription: string | null
  scheduleJson: string | null
  prepChecklistJson: string | null
  fixedDepartureWeekday: number | null
  durationDays: number | null
  trainingCategory: TrainingCategory | null
  trainingAudience: TrainingAudience | null
  destinationSummary: string | null
  parseWarning: string | null
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[0]) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

function pickInt(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v)) return null
  if (v < min || v > max) return null
  return v
}

function pickCategory(v: unknown): TrainingCategory | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return (TRAINING_CATEGORY_VALUES as readonly string[]).includes(t) ? (t as TrainingCategory) : null
}

function pickAudience(v: unknown): TrainingAudience | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return (TRAINING_AUDIENCE_VALUES as readonly string[]).includes(t) ? (t as TrainingAudience) : null
}

function normalizeScheduleDays(raw: unknown): Array<{ day: number; description: string }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ day: number; description: string }> = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const o = entry as Record<string, unknown>
    const day = typeof o.day === 'number' ? o.day : parseInt(String(o.day ?? ''), 10)
    const desc =
      typeof o.description === 'string'
        ? o.description.trim()
        : typeof o.title === 'string'
          ? o.title.trim()
          : ''
    if (!Number.isFinite(day) || day < 1 || !desc) continue
    out.push({ day, description: desc })
  }
  return out.sort((a, b) => a.day - b.day)
}

function normalizePrepSections(raw: unknown): Array<{ title: string; items: string[] }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ title: string; items: string[] }> = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const o = entry as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : '준비 사항'
    const items = Array.isArray(o.items)
      ? o.items.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim())
      : []
    if (items.length === 0 && !title) continue
    out.push({ title: title || '준비 사항', items })
  }
  return out
}

function descriptionContainsPrepBoilerplate(s: string): boolean {
  return WINDSOR_PREP_SECTION_TITLES.some((t) => s.includes(t))
}

function stripScheduleLinesFromText(text: string): string {
  return text
    .replace(
      /(?:^|\n)\s*(?:제\s*)?\d{1,2}\s*일(?:차)?\s*[:：\-]?[^\n]*(?:\n(?!\s*(?:제\s*)?\d{1,2}\s*일).+)*/gim,
      '\n'
    )
    .replace(/(?:^|\n)\s*DAY\s*0?\d{1,2}\b[^\n]*(?:\n(?!\s*DAY\s*\d).+)*/gim, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function mergePrepSections(
  fromRegex: Array<{ title: string; items: string[] }>,
  fromGemini: Array<{ title: string; items: string[] }>
): Array<{ title: string; items: string[] }> {
  if (fromRegex.length > 0) return fromRegex
  return fromGemini
}

function mergeScheduleDays(
  fromRegex: Array<{ day: number; description: string }>,
  fromGemini: Array<{ day: number; description: string }>
): Array<{ day: number; description: string }> {
  if (fromGemini.length >= fromRegex.length) return fromGemini
  return fromRegex
}

/**
 * 윈저·협력사 상품 페이지 paste → 국외연수 3블록 초안.
 */
export async function parseWindsorTrainingPaste(args: {
  pastedText: string
  originUrl?: string | null
}): Promise<WindsorPasteParseResult> {
  const pasted = args.pastedText.trim().slice(0, 80000)
  if (pasted.length < 40) {
    return {
      originalTitle: null,
      trainingDescription: pasted || null,
      scheduleJson: null,
      prepChecklistJson: null,
      fixedDepartureWeekday: null,
      durationDays: null,
      trainingCategory: null,
      trainingAudience: null,
      destinationSummary: null,
      parseWarning: '본문이 너무 짧습니다.',
    }
  }

  const windsorSplit = splitWindsorPasteForTraining(pasted)
  const regexPrep = windsorSplit.prepSections
  const regexSchedule = extractScheduleDaysFromProgramBody(windsorSplit.programBody)
  const llmBody =
    windsorSplit.programBody.length >= 80 ? windsorSplit.programBody : pasted

  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const prompt = `You extract overseas training / study tour program data from Korean travel agency paste text (often Windsor Tour style).

Return ONLY one JSON object with these keys:
- originalTitle: string (product title from source, keep Korean)
- trainingDescription: string (THIS program only: institutions, training theme, visit cities — plain text. Do NOT include agency boilerplate blocks.)
- scheduleDays: array of { day: number, description: string } (day-by-day itinerary only; no flight times)
- prepSections: array of { title: string, items: string[] } — leave [] here if boilerplate was already stripped from input
- fixedDepartureWeekday: integer 0-6 (0=Sunday) if a fixed weekday departure is stated; else null
- durationDays: integer program length in days if stated; else null
- trainingCategory: one of ${TRAINING_CATEGORY_VALUES.join('|')} or null
- trainingAudience: one of public|corporate|both or null
- destinationSummary: short region string (countries/cities)

CRITICAL — do NOT put these in trainingDescription (they belong in prepSections, handled separately):
해외여행 안전정보, 예약시 유의사항, 취소수수료, 여권/비자, 여행자보험, 여행준비물, 기타사항, 면세점, TAX FREE, 취소수수료 특별약관

Do not include prices. Do not invent institutions not implied by text.

[URL]
${(args.originUrl ?? '').trim()}

[PROGRAM_BODY — may exclude trailing travel-prep boilerplate]
${llmBody}
`.trim()

  try {
    const result = await model.generateContent(prompt, geminiTimeoutOpts())
    const text = result.response.text()
    const parsed = extractJsonObject(text)
    if (!parsed) {
      return fallbackFromRaw(pasted, 'JSON 파싱 실패 — 원문을 상품설명에 넣었습니다.')
    }

    const geminiSchedule = normalizeScheduleDays(parsed.scheduleDays)
    const geminiPrep = normalizePrepSections(parsed.prepSections)
    const scheduleDays = mergeScheduleDays(regexSchedule, geminiSchedule)
    const prepSections = mergePrepSections(regexPrep, geminiPrep)

    let trainingDescription =
      typeof parsed.trainingDescription === 'string' && parsed.trainingDescription.trim()
        ? parsed.trainingDescription.trim()
        : ''

    if (regexPrep.length > 0 && windsorSplit.programBody.length >= 80) {
      const fromProgramOnly = stripScheduleLinesFromText(windsorSplit.programBody).slice(0, 12000)
      if (
        !trainingDescription ||
        descriptionContainsPrepBoilerplate(trainingDescription) ||
        trainingDescription.length > fromProgramOnly.length * 1.2
      ) {
        trainingDescription = fromProgramOnly || trainingDescription
      }
    }
    if (!trainingDescription) {
      trainingDescription = stripScheduleLinesFromText(llmBody).slice(0, 12000) || pasted.slice(0, 12000)
    }

    const warnings: string[] = []
    if (windsorSplit.hasGenericPrepBlock) {
      warnings.push(
        '윈저 유럽 공통 안내문(안전정보·예약유의·취소·여권·보험·준비물 등)이 감지되어 「여행준비·체크」로 분리했습니다. 프로그램마다 동일할 수 있으니 검수·필요 시 수정하세요.'
      )
    }
    if (scheduleDays.length === 0 && regexPrep.length > 0) {
      warnings.push('일차별 상세일정이 paste에서 보이지 않습니다. 상세일정 JSON을 별도 붙여넣거나 수동 입력하세요.')
    }

    return {
      originalTitle:
        typeof parsed.originalTitle === 'string' && parsed.originalTitle.trim()
          ? parsed.originalTitle.trim().slice(0, 500)
          : null,
      trainingDescription,
      scheduleJson: scheduleDays.length > 0 ? JSON.stringify(scheduleDays) : null,
      prepChecklistJson: prepSections.length > 0 ? JSON.stringify(prepSections) : null,
      fixedDepartureWeekday: pickInt(parsed.fixedDepartureWeekday, 0, 6),
      durationDays: pickInt(parsed.durationDays, 1, 60),
      trainingCategory: pickCategory(parsed.trainingCategory),
      trainingAudience: pickAudience(parsed.trainingAudience),
      destinationSummary:
        typeof parsed.destinationSummary === 'string' && parsed.destinationSummary.trim()
          ? parsed.destinationSummary.trim().slice(0, 200)
          : null,
      parseWarning: warnings.length > 0 ? warnings.join(' ') : null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return fallbackFromRaw(pasted, `Gemini 분할 실패: ${msg}`)
  }
}

function fallbackFromRaw(pasted: string, warning: string): WindsorPasteParseResult {
  const split = splitWindsorPasteForTraining(pasted)
  const prep = split.prepSections
  const schedule = extractScheduleDaysFromProgramBody(split.programBody)
  const desc = stripScheduleLinesFromText(split.programBody).slice(0, 12000)

  return {
    originalTitle: null,
    trainingDescription: desc || pasted.slice(0, 12000),
    scheduleJson: schedule.length > 0 ? JSON.stringify(schedule) : null,
    prepChecklistJson: prep.length > 0 ? JSON.stringify(prep) : null,
    fixedDepartureWeekday: null,
    durationDays: null,
    trainingCategory: null,
    trainingAudience: null,
    destinationSummary: null,
    parseWarning: warning,
  }
}
