/**
 * Gemini 등 LLM 응답에서 JSON 객체를 안전하게 잘라낸다.
 * greedy 정규식 /\{[\s\S]*\}/ 는 문자열 안의 `}` 에서 조기 종료하거나 잘못된 범위를 잡아 JSON.parse 오류를 유발할 수 있다.
 */

/** ```json ... ``` 또는 ``` ... ``` 래퍼 제거 */
export function stripLlmMarkdownJsonFence(text: string): string {
  let t = text.trim()
  if (!t.startsWith('```')) return t
  const block = t.match(/^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```/im)
  if (block) return block[1].trim()
  t = t.replace(/^```(?:json)?\s*/i, '')
  const end = t.lastIndexOf('```')
  if (end > 0) t = t.slice(0, end)
  return t.trim()
}

/**
 * 첫 번째 `{` 부터 괄호 균형이 맞는 `}` 까지 잘라낸다. 문자열 리터럴 안의 `{` `}` 는 무시한다.
 */
export function extractFirstBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/**
 * 첫 `[` 부터 대괄호 균형이 맞는 `]` 까지. 문자열 리터럴 안의 `[` `]` 는 무시.
 */
export function extractFirstBalancedJsonArray(text: string): string | null {
  const start = text.indexOf('[')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function snippetForError(text: string, max = 240): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** 객체/배열 닫는 직전 trailing comma 제거(문자열 밖의 `,}` / `,]` 만 대상으로 반복). */
function stripTrailingCommasJsonLike(s: string): string {
  let out = s
  let prev = ''
  while (out !== prev) {
    prev = out
    out = out.replace(/,(\s*)([\]}])/g, '$1$2')
  }
  return out
}

function sliceFromFirstBraceToLastBrace(text: string): string | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return text.slice(start, end + 1)
}

function tryParseSingleObject(p: unknown): Record<string, unknown> | null {
  if (p !== null && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>
  if (Array.isArray(p) && p.length === 1 && typeof p[0] === 'object' && p[0] !== null && !Array.isArray(p[0])) {
    return p[0] as Record<string, unknown>
  }
  return null
}

function tryJsonParseObjectString(s: string): Record<string, unknown> | null {
  try {
    return tryParseSingleObject(JSON.parse(s) as unknown)
  } catch {
    return null
  }
}

/**
 * LLM 원문 디버그(잘림·코드펜스·꼬리 확인). 실패 시 또는 REGISTER_LLM_JSON_DEBUG=1 일 때 호출 권장.
 */
export function logLlmJsonRawDebug(label: string, raw: string, err?: unknown): void {
  const t = raw ?? ''
  const len = t.length
  const head = t.slice(0, 300)
  const tail = t.slice(Math.max(0, len - 300))
  const trimmedEnd = t.trimEnd()
  const payload = {
    label,
    length: len,
    head300: head,
    tail300: tail,
    endsWithClosingBrace: trimmedEnd.endsWith('}'),
    hasCodeFence: /```(?:json)?/i.test(t),
    error: err instanceof Error ? { name: err.name, message: err.message } : err != null ? String(err) : undefined,
  }
  console.error('[llm-json-raw]', JSON.stringify(payload))
}

export type ParseLlmJsonObjectOptions = {
  /** console `[llm-json-raw]` 에 붙일 구분자 */
  logLabel?: string
}

export function parseLlmJsonObject<T = Record<string, unknown>>(llmText: string, options?: ParseLlmJsonObjectOptions): T {
  const raw = llmText.trim().replace(/^\uFEFF/, '')
  const fenced = stripLlmMarkdownJsonFence(raw)
  const tryChunks = Array.from(new Set([fenced, raw].filter(Boolean)))

  const tryObjectString = (objStr: string): T | null => {
    const repaired = stripTrailingCommasJsonLike(objStr)
    for (const candidate of [objStr, repaired]) {
      const o = tryJsonParseObjectString(candidate)
      if (o) return o as T
    }
    return null
  }

  for (const chunk of tryChunks) {
    const direct = tryObjectString(chunk)
    if (direct) return direct
  }

  for (const chunk of tryChunks) {
    const objStr = extractFirstBalancedJsonObject(chunk)
    if (objStr) {
      const o = tryObjectString(objStr)
      if (o) return o
    }
  }

  for (const chunk of tryChunks) {
    const sliced = sliceFromFirstBraceToLastBrace(chunk)
    if (sliced) {
      const o = tryObjectString(sliced)
      if (o) return o
      const bal = extractFirstBalancedJsonObject(sliced)
      if (bal) {
        const o2 = tryObjectString(bal)
        if (o2) return o2
      }
    }
  }

  for (const chunk of tryChunks) {
    const arrStr = extractFirstBalancedJsonArray(chunk)
    if (arrStr) {
      try {
        const p = JSON.parse(stripTrailingCommasJsonLike(arrStr)) as unknown
        const o = tryParseSingleObject(p)
        if (o) return o as T
      } catch {
        /* continue */
      }
    }
  }

  const jsonStr =
    extractFirstBalancedJsonObject(fenced) ??
    extractFirstBalancedJsonObject(raw) ??
    sliceFromFirstBraceToLastBrace(fenced) ??
    sliceFromFirstBraceToLastBrace(raw)

  const label = options?.logLabel ?? 'parseLlmJsonObject'
  if (!jsonStr) {
    logLlmJsonRawDebug(label, raw, new Error('no_json_object_span'))
    throw new Error(
      `LLM이 유효한 JSON 객체를 반환하지 않았습니다. (응답 앞부분: ${snippetForError(raw)})`
    )
  }
  try {
    const o = tryObjectString(jsonStr)
    if (o) return o as T
    throw new SyntaxError('parsed value is not a JSON object')
  } catch (e) {
    logLlmJsonRawDebug(label, raw, e)
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `LLM JSON 파싱 실패: ${msg}. 본문에 따옴표·제어 문자가 많으면 구간을 나누어 붙여넣거나 짧게 줄여 다시 시도해 주세요. (응답 앞부분: ${snippetForError(raw)})`
    )
  }
}
