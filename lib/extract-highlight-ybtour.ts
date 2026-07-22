/**
 * 노랑풍선(ybtour) 전용 — 「여행포인트」 ✔ 리스트·goodsInfo core points.
 * 타 공급사와 공유하지 않음.
 *
 * REGRESSION-FREEZE[ybtour-register-highlight-corepoints]: formatYbtourHighlightPointsFromCorePoints — manifest
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

function isYbtourTravelPointLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  return (
    /[✔✓☑√]/.test(t) ||
    /^\[[ xX○●]\]\s*\S/.test(t) ||
    (/^\s*[\-–—\*]\s+\S/.test(t) && t.length > 3)
  )
}

function normalizeYbtourLine(line: string): string {
  let t = line.trim()
  t = t.replace(/^[\s✔✓☑√□■]+\s*/, '')
  t = t.replace(/^\[[ xX○●]\]\s*/, '')
  t = t.replace(/^[\-–—\*]\s+/, '')
  return t.replace(/\s{2,}/g, ' ').trim()
}

export function extractHighlightFromYbtour(rawHtml: string | unknown): string | null {
  const raw = coerceString(rawHtml)
  if (!raw.trim()) return null
  let plain = stripTags(breakHtmlLines(raw))
  plain = decodeEntities(plain)
  const hdr = /여행\s*포인트/
  const hm = plain.match(hdr)
  if (!hm || hm.index === undefined) return null
  let slice = plain.slice(hm.index + hm[0].length)
  slice = slice.replace(/^[^\n]*\n?/, '')
  const stop = slice.search(/\n\s*(?:■|▶|▷|DAY\s*\d|일정\s*안내|포함|불포함|쇼핑|호텔)/i)
  if (stop > 60) slice = slice.slice(0, stop)
  const lines = slice
    .split(/\n/)
    .filter(isYbtourTravelPointLine)
    .map((l) => normalizeYbtourLine(l))
    .filter(Boolean)
  const out = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!out) return null
  return out.length > MAX_HIGHLIGHT ? out.slice(0, MAX_HIGHLIGHT) : out
}

const YBTOUR_PRODUCT_KEEP_RE =
  /호텔|리조트|숙박|관광|체험|호핑|서핑|투어|특전|혜택|핵심|포인트|크루즈|골프|스파|야경|전망|미식|온천|하이라이트|가성비|포함/i

function isYbtourNonProductCoreLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  const hasProduct = YBTOUR_PRODUCT_KEEP_RE.test(t)
  if (/보험|SAFETY|안전\s*(?:수칙|안내)/i.test(t) && !hasProduct) return true
  if (/(?:비자|입국|출입국)/i.test(t) && !hasProduct) return true
  if (/예약\s*시|인원별\s*차량|최소\s*출발/i.test(t) && !hasProduct) return true
  if (t.length < 28 && !hasProduct) return true
  return false
}

/**
 * goodsInfo core bullets → product highlight subset.
 * REGRESSION-FREEZE[ybtour-register-highlight-corepoints]: goodsInfo product highlight — manifest
 */
export function formatYbtourHighlightPointsFromCorePoints(
  points: readonly string[] | null | undefined,
): string | null {
  if (!points?.length) return null
  const lines: string[] = []
  const seen = new Set<string>()
  for (const raw of points) {
    const line = normalizeYbtourLine(String(raw ?? ''))
    if (!line || isYbtourNonProductCoreLine(line)) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(line)
  }
  const out = lines.join('\n').trim()
  if (!out) return null
  return out.length > MAX_HIGHLIGHT ? out.slice(0, MAX_HIGHLIGHT) : out
}
