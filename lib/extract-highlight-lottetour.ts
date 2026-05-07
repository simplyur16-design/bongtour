/**
 * 롯데관광(lottetour) 전용 — 「Point 상품포인트」 ★ 리스트. 타 공급사와 공유하지 않음.
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

function isLottetourStarLine(line: string): boolean {
  const t = line.trim()
  return /^[\s★☆❋✦✧]*★/.test(t) || /^[\s\*]+\S/.test(t)
}

function normalizeLottetourLine(line: string): string {
  let t = line.trim()
  t = t.replace(/^[\s★☆❋✦✧]+\s*/, '')
  t = t.replace(/^\*\s+/, '')
  return t.replace(/\s{2,}/g, ' ').trim()
}

export function extractHighlightFromLottetour(rawHtml: string | unknown): string | null {
  const raw = coerceString(rawHtml)
  if (!raw.trim()) return null
  let plain = stripTags(breakHtmlLines(raw))
  plain = decodeEntities(plain)
  const hdr = /(?:Point|POINT)\s*상품\s*포인트|상품\s*포인트/i
  const hm = plain.match(hdr)
  if (!hm || hm.index === undefined) return null
  let slice = plain.slice(hm.index + hm[0].length)
  slice = slice.replace(/^[^\n]*\n?/, '')
  const stop = slice.search(/\n\s*(?:■|▶|▷|일정|포함|불포함|호텔|여행\s*약관)/i)
  if (stop > 60) slice = slice.slice(0, stop)
  const lines = slice
    .split(/\n/)
    .filter(isLottetourStarLine)
    .map((l) => normalizeLottetourLine(l))
    .filter(Boolean)
  if (lines.length === 0) {
    const fallback = slice
      .split(/\n/)
      .map((l) => normalizeLottetourLine(l))
      .filter((l) => l.length > 2 && !/^상품\s*포인트/i.test(l))
    const joined = fallback.join('\n').trim()
    if (!joined) return null
    const out = joined.length > MAX_HIGHLIGHT ? joined.slice(0, MAX_HIGHLIGHT) : joined
    return out || null
  }
  const out = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return out.length > MAX_HIGHLIGHT ? out.slice(0, MAX_HIGHLIGHT) : out
}
