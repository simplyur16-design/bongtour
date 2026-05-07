/**
 * 하나투어 전용 — 「📌 상품 핵심 포인트」 구간만. 타 공급사와 공유하지 않음.
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

/** 하나투어 라인 필터 — 패키지 등급·앵커만 있는 줄 제외 */
function keepHanatourPointLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^하나팩/i.test(t)) return false
  if (/세이브\b/i.test(t) && /특가|등급|패키지/i.test(t)) return false
  if (/^패키지\s*등급/i.test(t)) return false
  if (/^#\s*point\d+/i.test(t)) return false
  if (/^\s*#\s*point\d+\s*$/i.test(t)) return false
  if (/여행\s*약관|포함\s*내역|불포함/i.test(t) && t.length < 40) return false
  return true
}

function normalizeHanatourLine(line: string): string {
  let t = line.trim()
  t = t.replace(/\(#[^)]+\)/g, '')
  t = t.replace(/#point\d+/gi, '')
  t = t.replace(/^[\s📌•·∙※\-–—\*►▶]+\s*/, '')
  t = t.replace(/^\d+[\.)]\s+/, '')
  return t.replace(/\s{2,}/g, ' ').trim()
}

function finalize(lines: string[]): string | null {
  const out = lines
    .map((l) => normalizeHanatourLine(l))
    .filter((l) => l.length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!out) return null
  return out.length > MAX_HIGHLIGHT ? out.slice(0, MAX_HIGHLIGHT) : out
}

export function extractHighlightFromHanatour(rawHtml: string | unknown): string | null {
  const raw = coerceString(rawHtml)
  if (!raw.trim()) return null
  const plain = stripTags(breakHtmlLines(raw))
  const hdr = /📌\s*상품\s*핵심\s*포인트|상품\s*핵심\s*포인트/i
  const m = plain.match(hdr)
  if (!m || m.index === undefined) return null
  let slice = plain.slice(m.index + m[0].length)
  const stopRe =
    /\n\s*(?:📌|■|▶|▷|\[포함|\[불포함|포함\s*내역|불포함\s*내역|일정\s*표|여행\s*약관|상품\s*POINT|MODE)/i
  const stop = slice.search(stopRe)
  if (stop >= 0) slice = slice.slice(0, stop)
  const rawLines = slice.split(/\n/)
  const kept = rawLines.filter(keepHanatourPointLine)
  return finalize(kept)
}
