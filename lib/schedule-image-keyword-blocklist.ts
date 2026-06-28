/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: generic regional·공항 키워드 차단 — manifest
 */
const BLOCKED_PATTERNS: RegExp[] = [
  /^home$/i,
  /^incheon$/i,
  /^male$/i,
  /^leh$/i,
  /^singapore\s+airlines$/i,
  /^air\s*premia$/i,
  /^mirage\s*tourist\s*camp$/i,
  /\btourist\s*camp\b/i,
  /\bairlines?\b/i,
  /\bairways\b/i,
  /^international$/i,
  /^international\s+city\b/i,
  /international\s+city\s+travel\s+destination/i,
  /international\s+flight\s+airport/i,
  /incheon\s+international\s+airport/i,
  /\bdeparture\s+terminal\b/i,
  /\bairport\s+departure\b/i,
  /\bairport\s+window\b/i,
  /european\s+historic\s+city\s+center/i,
  /north\s+america\s+urban\s+skyline/i,
  /southeast\s+asia\s+tropical\s+city/i,
  /korea\s+modern\s+city\s+skyline/i,
  /scandinavia\s+nordic\s+waterfront/i,
  /baltic\s+historic\s+old\s+town/i,
  /british\s+isles\s+historic/i,
  /middle\s+east\s+historic\s+mosque/i,
  /africa\s+savanna/i,
  /oceania\s+coastal\s+city/i,
  /east\s+asia\s+metropolitan/i,
  /south\s+asia\s+historic\s+monument/i,
  /japan\s+city\s+street\s+skyline/i,
  /\bseoul\s+city\s+skyline\b/i,
]

/** 공항·지나치게 generic한 영문 키워드 — 1·2순위 모두 거부 */
export function isBlockedScheduleImageKeyword(kw: string | null | undefined): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (t.length < 4) return true
  return BLOCKED_PATTERNS.some((re) => re.test(t))
}

export function acceptScheduleImageKeywordOrEmpty(kw: string | null | undefined): string {
  const t = String(kw ?? '').trim()
  if (!t || isBlockedScheduleImageKeyword(t)) return ''
  return t
}
