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
  'boarding',
])

const WEAK_PLACE_ONLY = /^(city|downtown|town|area|region|route|highlights|itinerary)$/i

function isAirportNamedPlace(p: string): boolean {
  const t = squash(p)
  if (!t) return false
  if (/\b(international\s+)?airport\b/i.test(t)) return true
  if (/\b(ICN|GMP|CDG|CMB|BKK|NRT|HND|ARN|OSL)\b/i.test(t)) return true
  return false
}

function scoreEnglishPlaceImageKeywordCandidate(cand: string): number {
  let s = Math.min(cand.length, 48)
  if (
    /\b(Stupa|Pagoda|Dagoba|Temple|Palace|Castle|Museum|Fjord|Harbor|Harbour|Fortress|National|Royal|Gallery|Monument|Square|Tower|Fort)\b/i.test(
      cand
    )
  )
    s += 92
  if (/\b(fjord|geiranger|sigiriya|nyhavn|unesco)\b/i.test(cand)) s += 44
  if (isAirportNamedPlace(cand)) s -= 230
  return s
}

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
  /** 본문에 공항이 언급돼도, 추출된 장소명이 공항이 아니면 공항 삼단을 붙이지 않는다(비공항 명소 오염 방지). */
  if (isAirportNamedPlace(p)) {
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
  if (/\b(park|garden|lake|beach|bay|river|fjord)\b/i.test(h) && /\b(national|royal|botanical|geiranger)\b/i.test(p)) {
    return squash(`${p} / natural scenery / wide view`).slice(0, 180)
  }
  return squash(`${p} / landmark exterior / street-level view`).slice(0, 180)
}

const LANDMARK_ORDERED_PATTERNS: RegExp[] = [
  /\b(Temple\s+of\s+the\s+Tooth)\b/i,
  /\b(Ruwanwelisaya\s+Stupa)\b/i,
  /\b(Ruwanwelisaya)\b/i,
  /\b(Sigiriya(?:\s+Rock)?)\b/i,
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,6}\s+(?:Stupa|Pagoda|Dagoba))\b/i,
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}\s+(?:Temple|Palace|Castle|Museum|Gallery|Cathedral|Mosque|Bridge|Fort|Monument|Square|Tower))\b/,
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){2,}\s+(?:National|Royal)\s+(?:Park|Museum|Gallery))\b/,
]

const AIRPORT_ORDERED_PATTERNS: RegExp[] = [
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+International\s+Airport)\b/,
]

function extractFromPatterns(hayOneLine: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = hayOneLine.match(re)
    if (m) {
      const cand = (m[1] ?? m[0]).trim()
      if (!isBlacklistedPlaceCandidate(cand)) return cand.slice(0, 100)
    }
  }
  return null
}

function extractBestMultiwordTitleCase(
  hayOneLine: string,
  opts: { minParts: number; maxParts: number; avoidAirport: boolean }
): string | null {
  const { minParts, maxParts, avoidAirport } = opts
  const re = new RegExp(`\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){${minParts},${maxParts}})\\b`, 'g')
  let best = ''
  let bestScore = -1e9
  let mm: RegExpExecArray | null
  while ((mm = re.exec(hayOneLine)) !== null) {
    const cand = mm[1]!.trim()
    if (isBlacklistedPlaceCandidate(cand)) continue
    if (avoidAirport && isAirportNamedPlace(cand)) continue
    const sc = scoreEnglishPlaceImageKeywordCandidate(cand)
    if (sc > bestScore) {
      bestScore = sc
      best = cand
    }
  }
  if (best.length >= 8) return best.slice(0, 100)
  return null
}

/**
 * 원문·설명에서 영문 랜드마크·공항명 등을 뽑는다.
 * 스캔 순서: 원문 블록 → LLM description → title (서술형 title이 앞서면 장소 추출이 망가지는 것 방지)
 * 공항 패턴은 랜드마크·Title-Case 후보가 없을 때만 사용한다.
 */
export function extractPrimaryEnglishPlaceName(rawDayBody: string, description: string, title: string): string | null {
  const hay = squash([rawDayBody, description, title].filter(Boolean).join('\n'))
  if (!hay) return null
  const hayOneLine = hay.replace(/\n+/g, ' ')

  const fromLandmarks = extractFromPatterns(hayOneLine, LANDMARK_ORDERED_PATTERNS)
  if (fromLandmarks) return fromLandmarks

  const fromRuns = extractBestMultiwordTitleCase(hayOneLine, { minParts: 2, maxParts: 8, avoidAirport: true })
  if (fromRuns) return fromRuns

  const fromAirportPat = extractFromPatterns(hayOneLine, AIRPORT_ORDERED_PATTERNS)
  if (fromAirportPat) return fromAirportPat

  const fromRunsAny = extractBestMultiwordTitleCase(hayOneLine, { minParts: 2, maxParts: 8, avoidAirport: false })
  if (fromRunsAny) return fromRunsAny

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
  const curHead = cur.split('/')[0]!.trim()
  if (
    cur &&
    !/[가-힣]/.test(cur) &&
    !isBlacklistedPlaceCandidate(cur) &&
    /[A-Za-z]{5,}/.test(cur) &&
    !isAirportNamedPlace(curHead)
  ) {
    if (cur.includes('/')) return cur.slice(0, 180)
    return buildTripartite(cur.split(/\s+/).slice(0, 6).join(' '), cur.toLowerCase())
  }
  const hay = squash([opts.rawDayBody, opts.description, opts.title].filter(Boolean).join('\n'))
  const hayOne = hay.replace(/\n+/g, ' ')
  const late = extractBestMultiwordTitleCase(hayOne, { minParts: 2, maxParts: 6, avoidAirport: false })
  if (late) return buildTripartite(late, hay.toLowerCase())
  return 'Scenic stop / travel route context / street-level view'.slice(0, 180)
}
