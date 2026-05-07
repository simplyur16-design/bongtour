/**
 * 모두투어 전용 — Gemini로 상품 핵심 포인트 영역 추출·정리.
 * 타 공급사 LLM 파일과 프롬프트·로직을 공유하지 않음.
 */
import { parseGeminiJsonOutput } from '@/lib/bong-marketing/gemini-json-parse'
import { geminiTimeoutOpts, getGenAI, getModelName } from '@/lib/gemini-client'

const MAX_RAW_INPUT = 120_000
const MAX_FIELD_OUT = 5000
const GEMINI_TIMEOUT_MS = 90_000

function clipRaw(rawText: string): string {
  const t = rawText.trim()
  if (!t) return ''
  return t.length <= MAX_RAW_INPUT ? t : t.slice(0, MAX_RAW_INPUT)
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickStringField(o: Record<string, unknown>, key: string): string | null {
  const v = o[key]
  if (v == null) return null
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length ? s : null
}

function capField(s: string | null): string | null {
  if (!s) return null
  return s.length > MAX_FIELD_OUT ? s.slice(0, MAX_FIELD_OUT) : s
}

/** 정리본 토큰이 원문에 충분히 존재하는지 (환각 완화) */
function curatedGroundedInRaw(curated: string | null, sourceRaw: string): boolean {
  if (!curated?.trim()) return true
  const hay = sourceRaw.replace(/\s+/g, ' ')
  const tokens = curated.match(/[\p{L}\p{N}]{2,}/gu) ?? []
  if (tokens.length === 0) return false
  let hits = 0
  for (const t of tokens) {
    if (hay.includes(t)) hits++
  }
  return hits / tokens.length >= 0.45
}

function stripLeadingBullets(s: string): string {
  return s.replace(/^[\s•·∙※\-–—\*○◇►▶❖✔☑✓◆★]+/u, '').trim()
}

function rawExtractGrounded(rawExtract: string | null, sourceRaw: string): boolean {
  if (!rawExtract?.trim()) return false
  const hay = sourceRaw.replace(/\s+/g, ' ')
  const norm = (s: string) => stripLeadingBullets(s.replace(/\s+/g, ' ').trim())
  const lines = rawExtract
    .split(/\n/)
    .map((l) => norm(l))
    .filter((l) => l.length > 1)
  if (lines.length === 0) {
    const one = norm(rawExtract)
    return one.length >= 3 && hay.includes(one.slice(0, Math.min(one.length, 120)))
  }
  let hits = 0
  for (const line of lines) {
    if (line.length <= 3) {
      if (hay.includes(line)) hits++
      continue
    }
    if (hay.includes(line)) hits++
    else if (hay.includes(line.slice(0, Math.min(20, line.length)))) hits += 0.72
    else {
      const chunks = line.split(/[,，]/).map((p) => norm(p)).filter((p) => p.length >= 4)
      const chunkHits = chunks.filter((c) => hay.includes(c)).length
      if (chunks.length > 0 && chunkHits / chunks.length >= 0.45) hits += 0.65
    }
  }
  return hits / lines.length >= 0.42
}

const MODETOUR_SYSTEM = `당신은 모두투어 상세 페이지 붙여넣기 원문에서 특정 구역만 분리하는 도우미입니다.
반드시 JSON 객체만 출력합니다. 마크다운·코드펜스·주석 금지.

모두투어 규칙:
- 추출 대상은 「상품 POINT」「상품POINT」로 시작하는 블록만입니다.
- 「MODE'S EVENT」「MODE'S SHOPPING」「모드스 이벤트」 등 POINT 바깥 마케팅 섹션은 highlightPointsRaw에 넣지 마세요.
- 원문에 해당 블록이 없으면 highlightPointsRaw와 highlightPoints 모두 null.

환각 방지:
- 원문에 없는 사실·상품명·가격·일정을 새로 쓰지 마세요.
- highlightPointsRaw는 공급사 문구를 의미 단위로 유지하고, 불필요한 HTML 태그만 제거해도 됩니다. 내용 추가·삭제 금지.
- highlightPoints는 같은 사실을 봉투어 고객 안내 톤으로 다듬되, 새 정보를 넣지 마세요. 5~7줄, 한 줄에 핵심 1개.
`

const JSON_SCHEMA_HINT = `출력 스키마 (키만 이 순서로):
{
  "highlightPointsRaw": string | null,
  "highlightPoints": string | null
}`

export async function extractHighlightFromModetourLLM(rawText: string): Promise<{
  highlightPointsRaw: string | null
  highlightPoints: string | null
} | null> {
  const clipped = clipRaw(typeof rawText === 'string' ? rawText : String(rawText ?? ''))
  if (!clipped) return null
  if (!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()) return null

  const userBody = `${JSON_SCHEMA_HINT}

---RAW_START---
${clipped}
---RAW_END---
`

  const retryHint = `이전 응답이 JSON 파싱에 실패했습니다. 설명 없이 위 스키마의 JSON 객체 한 개만 출력하세요. 키 이름은 정확히 highlightPointsRaw, highlightPoints 입니다.`

  const genAI = getGenAI()
  const model = genAI.getGenerativeModel({
    model: getModelName(),
    systemInstruction: MODETOUR_SYSTEM,
  })

  const runOnce = async (text: string) => {
    const res = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      },
      geminiTimeoutOpts(GEMINI_TIMEOUT_MS)
    )
    return res.response.text() ?? ''
  }

  try {
    let out = await runOnce(userBody)
    let parsed = parseGeminiJsonOutput(out)
    if (!parsed.ok) {
      out = await runOnce(`${retryHint}\n\n${userBody}`)
      parsed = parseGeminiJsonOutput(out)
    }
    if (!parsed.ok) return null
    const rec = asRecord(parsed.value)
    if (!rec) return null
    let highlightPointsRaw = capField(pickStringField(rec, 'highlightPointsRaw'))
    let highlightPoints = capField(pickStringField(rec, 'highlightPoints'))

    if (!rawExtractGrounded(highlightPointsRaw, clipped)) return null
    if (highlightPoints != null && !curatedGroundedInRaw(highlightPoints, clipped)) {
      highlightPoints = null
    }

    highlightPointsRaw = highlightPointsRaw?.replace(/\r\n/g, '\n').trim() || null
    highlightPoints = highlightPoints?.replace(/\r\n/g, '\n').trim() || null

    return { highlightPointsRaw, highlightPoints }
  } catch (e) {
    console.warn('[llm-extract-highlight-modetour]', e instanceof Error ? e.message : e)
    return null
  }
}
