/**
 * 일정 `imageKeyword`: 영문 + 실존 장소·랜드마크 우선, Pexels/검색용 삼단
 * `Place name / visual element / viewpoint`
 */

const DAY_WORD = /\bday\s*\d+\b/i

/** 동사·진행·서술형으로 흔한 토큰 — 장소명 후보의 선두 토큰 금지 */
const NARRATIVE_LEADING = new Set([
  'arrival',
  'arrive',
  'depart',
  'departure',
  'return',
  'transfer',
  'meeting',
  'meet',
  'drive',
  'flight',
  'proceed',
  'continue',
  'option',
  'free',
  'leisure',
  'morning',
  'afternoon',
  'evening',
  'breakfast',
  'lunch',
  'dinner',
  'hotel',
  'then',
  'after',
  'before',
  'while',
  'during',
  'via',
  'en',
])

const WEAK_PLACE_ONLY = /^(city|downtown|town|area|region|route|highlights|itinerary)$/i

function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function firstToken(s: string): string {
  return (s.split(/\s+/)[0] ?? '').toLowerCase()
}

function isBlacklistedPlaceCandidate(s: string): boolean {
  const t = squash(s)
  if (!t || t.length < 4) return true
  if (DAY_WORD.test(t)) return true
  if (/[가-힣]/.test(t)) return true
  const ft = firstToken(t)
  if (NARRATIVE_LEADING.has(ft)) return true
  if (WEAK_PLACE_ONLY.test(ft) && t.split(/\s+/).length < 2) return true
  // "Colombo arrival", "Kandy city tour"
  if (/^[A-Z][a-z]+\s+(arrival|departure|return|transfer|tour)\b/i.test(t)) return true
  if (/\bcity\s+tour\b/i.test(t)) return true
  if (/\b(arrive at|return to|transfer to|departure for|pickup at)\b/i.test(t)) return true
  if (/^(return|transfer)\s+to\b/i.test(t)) return true
  return false
}

function buildTripartite(place: string, hayLower: string): string {
  const p = place.trim().slice(0, 90)
  const h = hayLower
  if (/\bairport\b|\binternational airport\b|\bicn\b|\bgmp\b|\bterminal\b/i.test(`${p} ${h}`)) {
    return squash(`${p} / airport terminal exterior / front view`).slice(0, 180)
  }
  if (/\bstupa\b|\bdagoba\b|\bpagoda\b|\bshrine\b|\btemple\b|\bmosque\b|\bcathedral\b|\bchurch\b/i.test(p)) {
    if (/stupa|dagoba|pagoda/i.test(p))
      return squash(`${p} / ornate religious architecture / close view`).slice(0, 180)
    return squash(`${p} / ornate shrine exterior / frontal view`).slice(0, 180)
  }
  if (/\b(bridge|tower|palace|castle|museum|gallery|fort|monument|square)\b/i.test(p)) {
    return squash(`${p} / facade and architectural detail / eye-level view`).slice(0, 180)
  }
  if (/\b(park|garden|lake|beach|bay|river)\b/i.test(h) && /\b(national|royal|botanical)\b/i.test(p)) {
    return squash(`${p} / natural scenery / wide view`).slice(0, 180)
  }
  return squash(`${p} / landmark exterior / street-level view`).slice(0, 180)
}

/**
 * 원문·설명에서 영문 랜드마크·공항명 등을 뽑는다.
 * 스캔 순서: 원문 블록 → LLM description → title (서술형 title이 앞서면 장소 추출이 망가지는 것 방지)
 */
export function extractPrimaryEnglishPlaceName(rawDayBody: string, description: string, title: string): string | null {
  const hay = squash([rawDayBody, description, title].filter(Boolean).join('\n'))
  if (!hay) return null
  const hayOneLine = hay.replace(/\n+/g, ' ')

  const orderedPatterns: RegExp[] = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+International\s+Airport)\b/,
    /\b(Temple\s+of\s+the\s+Tooth)\b/i,
    /\b(Ruwanwelisaya\s+Stupa)\b/i,
    /\b(Ruwanwelisaya)\b/i,
    /\b(Sigiriya(?:\s+Rock)?)\b/i,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,6}\s+(?:Stupa|Pagoda|Dagoba))\b/i,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}\s+(?:Temple|Palace|Castle|Museum|Gallery|Cathedral|Mosque|Bridge|Fort|Monument|Square|Tower))\b/,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){2,}\s+(?:National|Royal)\s+(?:Park|Museum|Gallery))\b/,
  ]

  for (const re of orderedPatterns) {
    const m = hayOneLine.match(re)
    if (m) {
      const cand = (m[1] ?? m[0]).trim()
      if (!isBlacklistedPlaceCandidate(cand)) return cand.slice(0, 100)
    }
  }

  let best = ''
  const rAll = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){2,8})\b/g
  let mm: RegExpExecArray | null
  while ((mm = rAll.exec(hayOneLine)) !== null) {
    const cand = mm[1]!.trim()
    if (!isBlacklistedPlaceCandidate(cand) && cand.length > best.length) best = cand
  }
  if (best.length >= 8) return best.slice(0, 100)
  return null
}

/** 참좋은 저장 직전: 영문 + 실존 장소 우선 삼단 */
export function buildEnglishPlaceTripartiteImageKeyword(opts: {
  title: string
  description: string
  rawDayBody: string
  currentKeyword?: string
}): string {
  const place = extractPrimaryEnglishPlaceName(opts.rawDayBody, opts.description, opts.title)
  if (place) {
    return buildTripartite(place, `${opts.rawDayBody} ${opts.description} ${opts.title}`.toLowerCase())
  }
  const cur = String(opts.currentKeyword ?? '').trim()
  if (cur && !/[가-힣]/.test(cur) && !isBlacklistedPlaceCandidate(cur) && /[A-Za-z]{5,}/.test(cur)) {
    if (cur.includes('/')) return cur.slice(0, 180)
    return buildTripartite(cur.split(/\s+/).slice(0, 6).join(' '), cur.toLowerCase())
  }
  const hay = squash([opts.rawDayBody, opts.description, opts.title].filter(Boolean).join('\n'))
  const hayOne = hay.replace(/\n+/g, ' ')
  let best = ''
  const rAll = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){2,6})\b/g
  let mm: RegExpExecArray | null
  while ((mm = rAll.exec(hayOne)) !== null) {
    const cand = mm[1]!.trim()
    if (!isBlacklistedPlaceCandidate(cand) && cand.length > best.length) best = cand
  }
  if (best.length >= 8) return buildTripartite(best, hay.toLowerCase())
  return 'Scenic stop / travel route context / street-level view'.slice(0, 180)
}
