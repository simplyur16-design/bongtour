import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import {
  TRAINING_AUDIENCE_VALUES,
  TRAINING_CATEGORY_VALUES,
  type TrainingAudience,
  type TrainingCategory,
} from '@/lib/overseas-training-taxonomy'

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

  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const prompt = `You extract overseas training / study tour program data from Korean travel agency paste text (often Windsor Tour style).

Return ONLY one JSON object with these keys:
- originalTitle: string (product title from source, keep Korean)
- trainingDescription: string (program intro, purpose, target institutions — plain text, newlines ok)
- scheduleDays: array of { day: number, description: string } (day-by-day itinerary, no flight times required)
- prepSections: array of { title: string, items: string[] } (travel prep, visa, documents, packing — categories like 출발 전/현지/귀국 후)
- fixedDepartureWeekday: integer 0-6 (0=Sunday) if a fixed weekday departure is stated; else null
- durationDays: integer program length in days if stated; else null
- trainingCategory: one of ${TRAINING_CATEGORY_VALUES.join('|')} or null
- trainingAudience: one of public|corporate|both or null
- destinationSummary: short region string (countries/cities)

Do not include prices. Do not invent institutions not implied by text.

[URL]
${(args.originUrl ?? '').trim()}

[PASTE]
${pasted}
`.trim()

  try {
    const result = await model.generateContent(prompt, geminiTimeoutOpts())
    const text = result.response.text()
    const parsed = extractJsonObject(text)
    if (!parsed) {
      return fallbackFromRaw(pasted, 'JSON 파싱 실패 — 원문을 상품설명에 넣었습니다.')
    }

    const scheduleDays = normalizeScheduleDays(parsed.scheduleDays)
    const prepSections = normalizePrepSections(parsed.prepSections)

    return {
      originalTitle:
        typeof parsed.originalTitle === 'string' && parsed.originalTitle.trim()
          ? parsed.originalTitle.trim().slice(0, 500)
          : null,
      trainingDescription:
        typeof parsed.trainingDescription === 'string' && parsed.trainingDescription.trim()
          ? parsed.trainingDescription.trim()
          : pasted.slice(0, 12000),
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
      parseWarning: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return fallbackFromRaw(pasted, `Gemini 분할 실패: ${msg}`)
  }
}

function fallbackFromRaw(pasted: string, warning: string): WindsorPasteParseResult {
  return {
    originalTitle: null,
    trainingDescription: pasted.slice(0, 12000),
    scheduleJson: null,
    prepChecklistJson: null,
    fixedDepartureWeekday: null,
    durationDays: null,
    trainingCategory: null,
    trainingAudience: null,
    destinationSummary: null,
    parseWarning: warning,
  }
}
