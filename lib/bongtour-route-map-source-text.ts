/**
 * 동선 교통용 원문 코퍼스 — included + rawMeta 내 교통 문장.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: collectBongtourRouteMapSourceText — manifest
 */

const TRANSPORT_LINE =
  /전용\s*차량|대형\s*버스|관광\s*버스|전세\s*버스|버스\s*이동|45인승|국내선|국제선|왕복\s*항공|케이블\s*카|푸니쿨라|유람선|전용차량/u

export function collectBongtourRouteMapSourceText(input: {
  includedText?: string | null
  excludedText?: string | null
  highlightPoints?: string | null
  highlightPointsRaw?: string | null
  summary?: string | null
  rawMeta?: string | null
}): string {
  const parts: string[] = []
  for (const s of [
    input.includedText,
    input.excludedText,
    input.highlightPoints,
    input.highlightPointsRaw,
    input.summary,
  ]) {
    if (s?.trim()) parts.push(s.trim())
  }

  const raw = input.rawMeta?.trim()
  if (raw) {
    // 전체 rawMeta는 거대 — 교통 키워드 주변만 추출
    const snippets: string[] = []
    const re = new RegExp(TRANSPORT_LINE.source, 'gu')
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) && snippets.length < 30) {
      const start = Math.max(0, m.index - 40)
      const end = Math.min(raw.length, m.index + m[0].length + 60)
      snippets.push(raw.slice(start, end))
    }
    if (snippets.length) parts.push(snippets.join('\n'))
  }

  return parts.join('\n')
}
