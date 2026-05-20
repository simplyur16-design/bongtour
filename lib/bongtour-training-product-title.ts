import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'

export type TrainingTitleSuggestInput = {
  originalTitle: string
  trainingCategory?: string | null
  destinationSummary?: string | null
  durationDays?: number | null
}

/** 국외연수 노출명 — 길이·정보 유지, 항공·판촉 제거 */
export async function suggestBongtourTrainingProductTitle(
  input: TrainingTitleSuggestInput
): Promise<{ title: string | null; error: string | null }> {
  const original = input.originalTitle.trim()
  if (!original) return { title: null, error: '원문 제목이 없습니다.' }

  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return { title: null, error: 'GEMINI_API_KEY가 없습니다.' }

  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const prompt = `Rewrite this overseas training program title for Bong투어 catalog (Korean).

Rules:
- Keep full descriptive length; do NOT shorten to a generic label.
- Remove airline names, flight numbers, (직항), promotional words.
- Unify punctuation: use · between regions, — before duration.
- Optional prefix tag from category only if it helps: [교육연수], [정책연수], etc.
- Keep day count like 9일 if present.
- Return ONLY JSON: { "title": "..." }

originalTitle: ${original}
category: ${input.trainingCategory ?? ''}
destination: ${input.destinationSummary ?? ''}
durationDays: ${input.durationDays ?? ''}
`.trim()

  try {
    const result = await model.generateContent(prompt, geminiTimeoutOpts())
    const text = result.response.text()
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return { title: null, error: 'LLM JSON 없음' }
    const parsed = JSON.parse(m[0]) as { title?: unknown }
    const t = typeof parsed.title === 'string' ? parsed.title.trim() : ''
    if (!t) return { title: null, error: '빈 제목' }
    return { title: t.slice(0, 280), error: null }
  } catch (e) {
    return { title: null, error: e instanceof Error ? e.message : 'unknown' }
  }
}
