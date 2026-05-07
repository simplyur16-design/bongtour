/**
 * 모두투어 전용 — 상세 붙여넣기에서 「상품 POINT」 블록만 추출 (MODE'S EVENT 제외).
 * 타 공급사·공통 유틸과 import/공유하지 않음.
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

function stripNoiseUrls(s: string): string {
  return s
    .replace(/https?:\/\/[^\s<>"')]+/gi, ' ')
    .replace(/drive\.google\.com[^\s]*/gi, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
}

/** 모두투어 본문 불릿 정리 — 이 파일 전용 */
function normalizeBulletLine(line: string): string {
  let t = line.trim()
  t = t.replace(/^[\s•·∙※\-–—\*○◇►▶❖]+\s*/, '')
  t = t.replace(/^\d+[\.)]\s+/, '')
  return t.trim()
}

function collapseNewlines(s: string): string {
  return s
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function finalizeBlock(block: string): string | null {
  let t = stripNoiseUrls(block)
  t = decodeEntities(t)
  t = t.replace(/[ \t\f\v]+/g, ' ')
  const lines = t
    .split(/\n/)
    .map((l) => normalizeBulletLine(l))
    .filter((l) => l.length > 0)
  const out = collapseNewlines(lines.join('\n'))
  if (!out) return null
  return out.length > MAX_HIGHLIGHT ? out.slice(0, MAX_HIGHLIGHT) : out
}

export function extractHighlightFromModetour(rawHtml: string | unknown): string | null {
  const raw = coerceString(rawHtml)
  if (!raw.trim()) return null
  const plain = stripTags(breakHtmlLines(raw))
  const startRe = /상품\s*POINT/i
  const sm = plain.match(startRe)
  if (!sm || sm.index === undefined) return null
  let slice = plain.slice(sm.index + sm[0].length)
  const modeStop = slice.search(/MODE['']S\s+EVENT/i)
  if (modeStop >= 0) slice = slice.slice(0, modeStop)
  slice = slice.replace(/MODE['']S\s+EVENT[\s\S]*/i, '')
  return finalizeBlock(slice)
}
