/**
 * 교원이지 전용 — tourEventTab corePoints → 상품 highlight.
 * 타 공급사와 공유하지 않음.
 *
 * REGRESSION-FREEZE[kyowontour-register-highlight-corepoints]: formatKyowontourHighlightPointsFromCorePoints — manifest
 */
const MAX_HIGHLIGHT = 8000

const PRODUCT_KEEP_RE =
  /호텔|리조트|숙박|관광|체험|호핑|서핑|투어|특전|혜택|핵심|포인트|크루즈|골프|스파|야경|전망|미식|맛집|온천|하이라이트|가성비|가심비/i

function isNonProductKyowontourHighlight(title: string, body: string): boolean {
  const blob = `${title}\n${body}`
  const hasProduct = PRODUCT_KEEP_RE.test(blob)
  if (/보험|SAFETY|안전\s*(?:수칙|안내)|여행자\s*보험/i.test(blob) && !hasProduct) return true
  if (/(?:비자|입국|출입국)/i.test(blob) && !hasProduct) return true
  if (/예약\s*(?:안내|시\s*확인)|인원별\s*차량|모객|최소\s*출발/i.test(blob) && !hasProduct) return true
  const plain = body.replace(/\s+/g, ' ').trim()
  if (plain.length > 0 && plain.length < 28 && !hasProduct) return true
  return false
}

/**
 * corePoints(상품 판매) → multiline highlight. 보험·비자·예약안내 제외.
 * REGRESSION-FREEZE[kyowontour-register-highlight-corepoints]: product corePoints highlight — manifest
 */
export function formatKyowontourHighlightPointsFromCorePoints(
  points: ReadonlyArray<{ title: string; body: string }> | null | undefined,
): string | null {
  if (!points?.length) return null
  const lines: string[] = []
  const seen = new Set<string>()
  for (const p of points) {
    const title = String(p.title ?? '').trim()
    const body = String(p.body ?? '').trim()
    if (!title && !body) continue
    if (isNonProductKyowontourHighlight(title, body || title)) continue
    const text =
      body && title && body !== title && !body.startsWith(title) ? `${title}\n${body}` : body || title
    for (const line of text.split(/\n/).map((l) => l.trim()).filter(Boolean)) {
      const key = line.toLowerCase()
      if (seen.has(key)) continue
      if (isNonProductKyowontourHighlight(title, line)) continue
      seen.add(key)
      lines.push(line)
    }
  }
  const out = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!out) return null
  return out.length > MAX_HIGHLIGHT ? out.slice(0, MAX_HIGHLIGHT) : out
}
