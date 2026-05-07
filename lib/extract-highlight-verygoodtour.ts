/**
 * 참좋은여행(verygood) 전용 — POINT 1 / 2 / 3 블록 연결. 타 공급사와 공유하지 않음.
 */
const MAX_HIGHLIGHT = 8000

function coerceString(raw: string | unknown): string {
  if (typeof raw === 'string') return raw
  if (raw == null) return ''
  return String(raw)
}

function breakHtmlLines(html: string): string {
  return html
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)\s*>/gi, '\n')
}

function stripTags(html: string): string {
  const noBlock = html.replace(/<script[\s\S]*?<\/script>/gi, '\n').replace(/<style[\s\S]*?<\/style>/gi, '\n')
  return noBlock.replace(/<[^>]+>/g, ' ')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function normalizeVerygoodLine(line: string): string {
  let t = line.trim()
  t = t.replace(/^[\s•·∙※\-–—\*►▶]+\s*/, '')
  t = t.replace(/^\d+[\.)]\s+/, '')
  return t.replace(/\s{2,}/g, ' ').trim()
}

function extractPointBlocks(plain: string): string | null {
  const re = /\bPOINT\s*([123])\b/gi
  const hits: { idx: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(plain)) !== null) {
    hits.push({ idx: m.index })
  }
  if (hits.length === 0) return null
  const parts: string[] = []
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i]!.idx
    const end = i + 1 < hits.length ? hits[i + 1]!.idx : plain.length
    let chunk = plain.slice(start, end)
    chunk = chunk.replace(/^\s*POINT\s*[123]\s*[.:：]?\s*/i, '').trim()
    const lines = chunk
      .split(/\n/)
      .map((l) => normalizeVerygoodLine(l))
      .filter(Boolean)
    if (lines.length) parts.push(lines.join('\n'))
  }
  const merged = parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
  return merged || null
}

export function extractHighlightFromVerygoodtour(rawHtml: string | unknown): string | null {
  const raw = coerceString(rawHtml)
  if (!raw.trim()) return null
  let plain = stripTags(breakHtmlLines(raw))
  plain = decodeEntities(plain)
  const block = extractPointBlocks(plain)
  if (!block) return null
  return block.length > MAX_HIGHLIGHT ? block.slice(0, MAX_HIGHLIGHT) : block
}
