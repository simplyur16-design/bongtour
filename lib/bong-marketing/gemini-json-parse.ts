/**
 * Gemini 텍스트 응답에서 JSON 객체 추출 (잡문자·펜스·trailing comma 등 완화).
 */

export type GeminiJsonStrategy = 'raw' | 'fenced' | 'braces' | 'comma_clean' | 'failed'

export type ParseGeminiJsonOk = {
  ok: true
  value: unknown
  strategy: Exclude<GeminiJsonStrategy, 'failed'>
}

export type ParseGeminiJsonFail = {
  ok: false
  value?: undefined
  strategy: 'failed'
  /** 사람이 읽기 위한 마지막 오류 메시지 */
  error: string
  /** 요약 코드 (예: all_strategies_exhausted) */
  errorReason: string
}

export type ParseGeminiJsonResult = ParseGeminiJsonOk | ParseGeminiJsonFail

/** `,]` 또는 `,}` 형태의 trailing comma만 제거 (문자열 내부는 단순 휴리스틱) */
export function stripJsonTrailingCommas(json: string): string {
  return json.replace(/,(\s*[\]}])/g, '$1')
}

function tryJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** 첫 `{`부터 문자열 리터럴을 고려해 depth==0이 되는 첫 번째 완전한 객체 구간만 추출 (닫는 `}` 뒤 잡문자 제거) */
export function extractFirstBalancedJsonObject(rawText: string): string | null {
  const start = rawText.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < rawText.length; i++) {
    const c = rawText[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (c === '\\') escape = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return rawText.slice(start, i + 1)
    }
  }
  return null
}

function sliceJsonByGreedyBraces(rawText: string): string | null {
  const start = rawText.indexOf('{')
  const end = rawText.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  return rawText.slice(start, end + 1)
}

/**
 * Gemini 출력 문자열에서 JSON을 순차 전략으로 파싱합니다.
 *
 * 1. **raw** — trim 후 그대로 `JSON.parse`
 * 2. **fenced** — 첫 번째 \`\`\`json … \`\`\` / \`\`\` … \`\`\` 블록 내용 파싱
 * 3. **braces** — 첫 `{`부터 **문자열을 고려한 균형 중괄호**로 첫 완전 객체 구간을 자르고, 실패 시 `{`~마지막 `}` greedy 보조 후 파싱
 * 4. **comma_clean** — (3)과 동일 구간에 trailing comma 제거 후 파싱
 * 5. **failed** — 위가 모두 실패
 */
export function parseGeminiJsonOutput(rawText: string): ParseGeminiJsonResult {
  const trimmed = rawText.trim()

  const rawVal = tryJsonParse(trimmed)
  if (rawVal !== null) {
    return { ok: true, value: rawVal, strategy: 'raw' }
  }

  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) {
    const inner = fenced[1].trim()
    const fencedVal = tryJsonParse(inner)
    if (fencedVal !== null) {
      return { ok: true, value: fencedVal, strategy: 'fenced' }
    }
  }

  const braceCandidates: string[] = []
  const balanced = extractFirstBalancedJsonObject(rawText)
  const greedy = sliceJsonByGreedyBraces(rawText)
  if (balanced) braceCandidates.push(balanced)
  if (greedy && greedy !== balanced) braceCandidates.push(greedy)

  for (const slice of braceCandidates) {
    const braceVal = tryJsonParse(slice)
    if (braceVal !== null) {
      return { ok: true, value: braceVal, strategy: 'braces' }
    }
    const cleaned = stripJsonTrailingCommas(slice)
    const commaVal = tryJsonParse(cleaned)
    if (commaVal !== null) {
      return { ok: true, value: commaVal, strategy: 'comma_clean' }
    }
  }

  let lastMsg = 'JSON.parse failed for all strategies'
  try {
    JSON.parse(trimmed)
  } catch (e) {
    lastMsg = e instanceof Error ? e.message : String(e)
  }

  return {
    ok: false,
    strategy: 'failed',
    error: lastMsg,
    errorReason: 'all_strategies_exhausted',
  }
}
