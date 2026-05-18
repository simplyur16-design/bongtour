/**
 * 일정 원문·제목·설명에서 영문 랜드마크명 추출 (Pexels imageKeyword SSOT 보조).
 */

const DAY_WORD = /\bday\s*\d+\b/i

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

function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function firstToken(s: string): string {
  return (s.split(/\s+/)[0] ?? '').toLowerCase()
}

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
      cand,
    )
  )
    s += 92
  if (/\b(fjord|geiranger|sigiriya|nyhavn|unesco)\b/i.test(cand)) s += 44
  if (isAirportNamedPlace(cand)) s -= 230
  return s
}

function isBlacklistedPlaceCandidate(s: string): boolean {
  const t = squash(s)
  if (!t || t.length < 4) return true
  if (DAY_WORD.test(t)) return true
  if (/[가-힣]/.test(t)) return true
  const ft = firstToken(t)
  if (NARRATIVE_LEADING.has(ft)) return true
  if (WEAK_PLACE_ONLY.test(ft) && t.split(/\s+/).length < 2) return true
  if (/^[A-Z][a-z]+\s+(arrival|departure|return|transfer|tour)\b/i.test(t)) return true
  if (/\bcity\s+tour\b/i.test(t)) return true
  if (/\b(arrive at|return to|transfer to|departure for|pickup at)\b/i.test(t)) return true
  if (/^(return|transfer)\s+to\b/i.test(t)) return true
  return false
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
  opts: { minParts: number; maxParts: number; avoidAirport: boolean },
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

export function extractPrimaryEnglishPlaceName(
  rawDayBody: string,
  description: string,
  title: string,
): string | null {
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
