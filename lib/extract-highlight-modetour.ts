/**
 * 모두투어 전용 — 상세 붙여넣기 「상품 POINT」·GetProductKeyPointInfo 상품 판매 포인트.
 * 타 공급사·공통 유틸과 import/공유하지 않음.
 *
 * REGRESSION-FREEZE[modetour-register-highlight-keypoint]: formatModetourHighlightPointsFromKeyPointInfo — manifest
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

function asRows(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function isModetourInsuranceOrGuaranteeLine(line: string): boolean {
  return /보험|공제|보증|보장\s*한도|여행자\s*보험|businessGuarantee|travelerInsurance/i.test(line)
}

/**
 * GetProductKeyPointInfo — specialBenefits·sightseeings·hotels → highlight.
 * 보험·공제/보증 제외. meals/leader는 mustKnow 축에 두고 highlight에서는 생략.
 * REGRESSION-FREEZE[modetour-register-highlight-keypoint]: keyPoint product highlight — manifest
 */
export function formatModetourHighlightPointsFromKeyPointInfo(
  keyPoint: Record<string, unknown> | null | undefined,
): string | null {
  if (!keyPoint) return null
  const lines: string[] = []
  const seen = new Set<string>()
  const push = (raw: unknown) => {
    const b = normalizeBulletLine(decodeEntities(stripTags(breakHtmlLines(String(raw ?? '')))))
    if (!b || b === '상품 핵심 포인트') return
    if (isModetourInsuranceOrGuaranteeLine(b)) return
    const key = b.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    lines.push(b)
  }
  for (const row of asRows(keyPoint.specialBenefits)) push(row)
  for (const row of asRows(keyPoint.sightseeings)) push(row)
  for (const row of asRows(keyPoint.hotels)) push(row)
  return finalizeBlock(lines.join('\n'))
}
