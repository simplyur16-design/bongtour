import 'server-only'

import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import type { PageHeroMonthlyGeminiJob } from '@/lib/page-hero-monthly-types'

const GEMINI_TEXT_TIMEOUT_MS = Math.min(30_000, 25_000)

export function sanitizePageHeroEditorialGeminiLine(raw: string): string {
  let t = String(raw ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/["'`""''«»]/g, '')
    .trim()
  t = t.replace(/\s+/g, ' ')
  if (t.length > 80) t = `${t.slice(0, 78).trimEnd()}…`
  return t
}

function buildGeminiUserPrompt(jobs: PageHeroMonthlyGeminiJob[]): string {
  const tasks = jobs.map((j, i) => ({
    i,
    month: j.targetMonth1To12,
    place: (j.destinationDisplay ?? '').trim() || (j.travelScope === 'domestic' ? '국내' : '해외'),
    scope: j.travelScope === 'domestic' ? '국내' : '해외',
  }))
  return `아래 각 작업에 대해 한국어 한 문장씩만 작성하세요.

작업 목록(JSON):
${JSON.stringify(tasks)}

출력 형식(반드시 이 JSON만, 설명 없이):
{"lines":["문장0","문장1",...]}

규칙:
- lines 배열 길이는 ${jobs.length}와 정확히 같고, 순서는 작업 i 순서와 같아야 함.
- 각 문장: 한 줄, 한국어만. 30~55자 권장, 최대 80자.
- 해당 월의 여행 분위기·계절감을 살짝 담고, place(여행지/권역)를 자연스럽게 포함.
- 상품 광고·가격·예약 유도·과장·허위 표현 금지. 에디토리얼 상단 멘트 톤.
- 따옴표·이모지·느낌표 나열·해시태그 금지.
- scope가 국내이면 국내 여행 맥락, 해외이면 해외 여행 맥락.`
}

/**
 * 한 번의 generateContent로 jobs 개수만큼의 1줄 멘트를 받는다. 서버 전용.
 */
export async function generatePageHeroMonthlyEditorialLinesWithGemini(
  jobs: PageHeroMonthlyGeminiJob[]
): Promise<{ ok: true; lines: string[] } | { ok: false; error: string }> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) return { ok: false, error: 'no_api_key' }
  if (jobs.length === 0) return { ok: false, error: 'empty_jobs' }
  if (jobs.length > 12) return { ok: false, error: 'too_many_jobs' }

  try {
    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({ model: getModelName() })
    const prompt = buildGeminiUserPrompt(jobs)
    const result = await model.generateContent(prompt, geminiTimeoutOpts(GEMINI_TEXT_TIMEOUT_MS))
    const text = result.response.text()?.trim() ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { ok: false, error: 'no_json' }
    const parsed = JSON.parse(jsonMatch[0]) as { lines?: unknown }
    if (!Array.isArray(parsed.lines)) return { ok: false, error: 'invalid_lines' }
    const rawLines = parsed.lines.map((x) => String(x ?? '').trim())
    if (rawLines.length !== jobs.length) return { ok: false, error: 'lines_length_mismatch' }
    const lines = rawLines.map(sanitizePageHeroEditorialGeminiLine).filter((s) => s.length > 0)
    if (lines.length !== jobs.length) return { ok: false, error: 'empty_line_after_sanitize' }
    return { ok: true, lines }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[page-hero-monthly-gemini-server]', msg)
    return { ok: false, error: msg }
  }
}
