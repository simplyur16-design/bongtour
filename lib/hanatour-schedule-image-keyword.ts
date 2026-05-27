import {
  classifyHanatourScheduleCardDayKind,
  extractOrderedKnownPoiFromJoined,
  hanatourImageKeywordNeedsReplace,
  mapHanatourKoreanSightFragmentToEnglishPexels,
  type HanatourScheduleCardDayKind,
} from '@/lib/parse-and-register-hanatour-schedule'
import { extractPrimaryEnglishPlaceName } from '@/lib/english-schedule-place-extract'
import {
  extractEnglishPoiFromLabel,
  mapDestination,
  mapKoreanPoiSegment,
  normalizeSemanticPoiKey,
} from '@/lib/pexels-keyword'
import {
  finalizeScheduleImageKeyword,
  isBareCityOrCountryKeyword,
  isLikelyTourismLandmarkKeyword,
  normalizeToPlaceName,
} from '@/lib/pexels-place-name-keyword'

export type HanatourScheduleImageKeywordOpts = {
  productDestination?: string | null
}

export type HanatourScheduleImageKeywordRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

const DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

/** haystack에 해당 표기가 있을 때만 fragment→영문 (고정 폴백 아님) */
const HANATOUR_BODY_GROUNDED_KO_TO_EN: ReadonlyArray<{ ko: RegExp; en: string }> = [
  { ko: /델리|Delhi/i, en: 'Delhi' },
  { ko: /타지\s*마할|Taj\s*Mahal/i, en: 'Taj Mahal' },
  { ko: /후마운(?:\s*투)?\s*묘|Humayun(?:['\u2019]s)?\s*Tomb/i, en: "Humayun's Tomb" },
  { ko: /아그라|Agra/i, en: 'Agra' },
  { ko: /인도|India/i, en: 'India' },
  { ko: /상해|上海|Shanghai/i, en: 'Shanghai' },
  { ko: /연길|延吉|Yanji/i, en: 'Yanji' },
  { ko: /방콕|Bangkok/i, en: 'Bangkok' },
  { ko: /도쿄|東京|Tokyo/i, en: 'Tokyo' },
  { ko: /파리|Paris/i, en: 'Paris' },
  { ko: /싱가포르|Singapore/i, en: 'Singapore' },
  { ko: /홍콩|香港|Hong\s*Kong/i, en: 'Hong Kong' },
  { ko: /후쿠오카|福岡|Fukuoka/i, en: 'Fukuoka' },
  { ko: /나고야|名古屋|Nagoya/i, en: 'Nagoya' },
  { ko: /유후인|Yufuin/i, en: 'Yufuin' },
  { ko: /다자이후|太宰府|Dazaifu(?:\s*Tenmangu)?/i, en: 'Dazaifu Tenmangu' },
]

function normKey(s: string): string {
  return normalizeSemanticPoiKey(s)
}

function buildHanatourDayHaystack(row: HanatourScheduleImageKeywordRow): string {
  return [row.title, row.description, row.routeText].filter(Boolean).join('\n').replace(/\r/g, '')
}

function stripRouteSegmentNoise(seg: string): string {
  return seg
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 인천·부산·대구·청주·김포·ICN/GMP 등 — imageKeyword 후보에서 제외 */
export function isHanatourDomesticHubToken(token: string): boolean {
  const t = stripRouteSegmentNoise(token)
  if (!t) return true
  if (DOMESTIC_HUB_KO_RE.test(t)) return true
  if (DOMESTIC_HUB_EN_RE.test(t)) return true
  if (/^인천(?:국제)?공항$/u.test(t)) return true
  if (/^김포(?:국제)?공항$/u.test(t)) return true
  if (/^부산(?:국제)?공항$/u.test(t)) return true
  if (/^대구(?:국제)?공항$/u.test(t)) return true
  if (/^청주(?:국제)?공항$/u.test(t)) return true
  return false
}

function routeTextSegments(routeText: string | null | undefined): string[] {
  const rt = String(routeText ?? '').trim()
  if (!rt) return []
  return rt
    .split(/\s*-\s*/)
    .map(stripRouteSegmentNoise)
    .filter((s) => s.length >= 2)
}

function mapBodyGroundedKoToEn(fragment: string, haystack: string): string | null {
  const f = fragment.trim()
  if (!f) return null
  for (const { ko, en } of HANATOUR_BODY_GROUNDED_KO_TO_EN) {
    if (!ko.test(haystack)) continue
    if (ko.test(f)) return en
  }
  return null
}

function mapHanatourFragmentToEnglish(fragment: string, haystack: string): string {
  const f = stripRouteSegmentNoise(fragment)
  if (!f || isHanatourDomesticHubToken(f)) return ''

  const bodyKo = mapBodyGroundedKoToEn(f, haystack)
  if (bodyKo) {
    try {
      return finalizeScheduleImageKeyword(bodyKo)
    } catch {
      return ''
    }
  }

  const hanatourHit = mapHanatourKoreanSightFragmentToEnglishPexels(f, haystack)
  if (hanatourHit) {
    try {
      return finalizeScheduleImageKeyword(hanatourHit)
    } catch {
      return ''
    }
  }

  const poi = mapKoreanPoiSegment(f)
  if (poi) {
    try {
      return finalizeScheduleImageKeyword(poi)
    } catch {
      return ''
    }
  }

  const dest = mapDestination(f)
  if (dest && dest.trim() && !isHanatourDomesticHubToken(dest)) {
    try {
      return finalizeScheduleImageKeyword(dest)
    } catch {
      return ''
    }
  }

  const latin = extractEnglishPoiFromLabel(f)
  if (latin && !isHanatourDomesticHubToken(latin)) {
    try {
      return finalizeScheduleImageKeyword(latin)
    } catch {
      return ''
    }
  }

  return ''
}

function collectEnglishCandidatesForRow(row: HanatourScheduleImageKeywordRow): string[] {
  const haystack = buildHanatourDayHaystack(row)
  const out: string[] = []
  const seen = new Set<string>()

  const pushFin = (fin: string) => {
    if (!fin) return
    const key = normKey(fin)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push(fin)
  }

  for (const seg of routeTextSegments(row.routeText)) {
    pushFin(mapHanatourFragmentToEnglish(seg, haystack))
  }

  for (const ko of extractOrderedKnownPoiFromJoined(haystack)) {
    pushFin(mapHanatourFragmentToEnglish(ko, haystack))
  }

  const fromBody = extractPrimaryEnglishPlaceName(
    haystack,
    String(row.description ?? ''),
    String(row.title ?? ''),
  )
  if (fromBody) {
    try {
      pushFin(finalizeScheduleImageKeyword(fromBody))
    } catch {
      /* skip */
    }
  }

  return out
}

function overseasCityCandidates(candidates: string[]): string[] {
  return candidates.filter((c) => c && !isHanatourDomesticHubToken(c))
}

function landmarkCandidates(candidates: string[]): string[] {
  return candidates.filter((c) => isLikelyTourismLandmarkKeyword(c) && !isBareCityOrCountryKeyword(c))
}

function pickOverseasCityForMovementDay(
  row: HanatourScheduleImageKeywordRow,
  day: number,
  maxDay: number,
  allRows: HanatourScheduleImageKeywordRow[],
): string {
  const haystack = buildHanatourDayHaystack(row)
  const rowCandidates = collectEnglishCandidatesForRow(row)

  const routeMapped = routeTextSegments(row.routeText)
    .map((s) => mapHanatourFragmentToEnglish(s, haystack))
    .filter((c) => c && !isHanatourDomesticHubToken(c))
  const routeCities = overseasCityCandidates(routeMapped)

  if (day === 1 && routeCities.length) return routeCities[0]!
  if (day === maxDay && routeCities.length) return routeCities[routeCities.length - 1]!

  const cities = overseasCityCandidates(rowCandidates)
  if (day === 1 && cities.length) return cities[0]!
  if (day === maxDay && cities.length) return cities[cities.length - 1]!

  const tripOverseas: string[] = []
  const tripSeen = new Set<string>()
  for (const r of allRows.filter((x) => x.day > 0).sort((a, b) => a.day - b.day)) {
    for (const seg of routeTextSegments(r.routeText)) {
      if (isHanatourDomesticHubToken(seg)) continue
      const fin = mapHanatourFragmentToEnglish(seg, buildHanatourDayHaystack(r))
      if (!fin || isHanatourDomesticHubToken(fin)) continue
      const key = normKey(fin)
      if (tripSeen.has(key)) continue
      tripSeen.add(key)
      tripOverseas.push(fin)
    }
  }
  if (day === 1 && tripOverseas.length) return tripOverseas[0]!
  if (day === maxDay && tripOverseas.length) return tripOverseas[tripOverseas.length - 1]!

  return cities[0] ?? rowCandidates.find((c) => !isHanatourDomesticHubToken(c)) ?? ''
}

function pushUniqueEnglishGroundedCandidate(out: string[], seen: Set<string>, fin: string): void {
  if (!fin) return
  const key = normKey(fin)
  if (!key || seen.has(key)) return
  seen.add(key)
  out.push(fin)
}

/** 한글 haystack → 영문 후보집합(LLM grounded 판정용). 본문·routeText·known POI를 mapHanatourFragmentToEnglish로 영문화 */
function buildEnglishGroundedCandidateSet(haystack: string, mappedCandidates: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const cand of mappedCandidates) {
    pushUniqueEnglishGroundedCandidate(out, seen, cand)
  }

  for (const { ko, en } of HANATOUR_BODY_GROUNDED_KO_TO_EN) {
    if (!ko.test(haystack)) continue
    try {
      pushUniqueEnglishGroundedCandidate(out, seen, finalizeScheduleImageKeyword(en))
    } catch {
      /* skip */
    }
  }

  const segments = new Set<string>()
  for (const line of haystack.split(/\r?\n/)) {
    for (const seg of line.split(/\s*-\s*/)) {
      const s = stripRouteSegmentNoise(seg)
      if (s.length >= 2) segments.add(s)
    }
  }
  for (const ko of extractOrderedKnownPoiFromJoined(haystack)) {
    segments.add(ko)
  }

  for (const seg of segments) {
    pushUniqueEnglishGroundedCandidate(out, seen, mapHanatourFragmentToEnglish(seg, haystack))
  }

  const poiFromHay = mapKoreanPoiSegment(haystack)
  if (poiFromHay) {
    try {
      pushUniqueEnglishGroundedCandidate(out, seen, finalizeScheduleImageKeyword(poiFromHay))
    } catch {
      /* skip */
    }
  }

  return out
}

function hanatourEnglishKeywordMatchesGroundedCandidate(llmFin: string, candidate: string): boolean {
  const finLower = normalizeToPlaceName(llmFin).toLowerCase()
  const candLower = normalizeToPlaceName(candidate).toLowerCase()
  if (!finLower || !candLower) return false

  const finKey = normKey(finLower)
  const candKey = normKey(candLower)
  if (finKey && candKey && finKey === candKey) return true
  if (finLower === candLower) return true

  if (finLower.length >= 4 && candLower.includes(finLower)) return true
  if (candLower.length >= 4 && finLower.includes(candLower)) return true

  const finWords = finLower.split(/\s+/).filter((w) => w.length >= 4)
  if (finWords.length && finWords.every((w) => candLower.includes(w))) return true

  const candWords = candLower.split(/\s+/).filter((w) => w.length >= 4)
  if (candWords.length && candWords.every((w) => finLower.includes(w))) return true

  return false
}

/** LLM 영문 키워드가 한글 haystack에서 영문화한 후보집합과 대응하는지(영문 literal includes 아님) */
export function isHanatourLlmImageKeywordGroundedInHaystack(
  llmKeyword: string,
  haystack: string,
  mappedCandidates: string[],
): boolean {
  const fin = normalizeToPlaceName(String(llmKeyword ?? '').trim())
  if (!fin) return false
  const key = normKey(fin)
  if (!key) return false

  if (isHanatourDomesticHubToken(fin)) return false

  const groundedCandidates = buildEnglishGroundedCandidateSet(haystack, mappedCandidates)
  for (const cand of groundedCandidates) {
    if (hanatourEnglishKeywordMatchesGroundedCandidate(fin, cand)) return true
  }

  return false
}

function resolveHanatourPrimaryKeyword(
  row: HanatourScheduleImageKeywordRow,
  dayKind: HanatourScheduleCardDayKind,
  maxDay: number,
  allRows: HanatourScheduleImageKeywordRow[],
): string {
  const haystack = buildHanatourDayHaystack(row)
  const candidates = collectEnglishCandidatesForRow(row)
  const llmRaw = String(row.imageKeyword ?? '').trim()

  if (llmRaw && !hanatourImageKeywordNeedsReplace(llmRaw)) {
    if (isHanatourLlmImageKeywordGroundedInHaystack(llmRaw, haystack, candidates)) {
      try {
        return finalizeScheduleImageKeyword(llmRaw)
      } catch {
        /* fall through */
      }
    }
  }

  if (dayKind === 'movement' || dayKind === 'return_home') {
    return pickOverseasCityForMovementDay(row, row.day, maxDay, allRows)
  }

  const landmarks = landmarkCandidates(candidates)
  if (landmarks.length) return landmarks[0]!

  const cities = overseasCityCandidates(candidates)
  if (cities.length) return cities[0]!

  return candidates[0] ?? ''
}

function resolveHanatourSecondaryKeyword(
  row: HanatourScheduleImageKeywordRow,
  primary: string,
  dayKind: HanatourScheduleCardDayKind,
  maxDay: number,
  allRows: HanatourScheduleImageKeywordRow[],
): string | null {
  const haystack = buildHanatourDayHaystack(row)
  const candidates = collectEnglishCandidatesForRow(row)
  const primaryKey = normKey(primary)
  const llmRaw = String(row.imageKeyword2 ?? '').trim()

  if (llmRaw && !hanatourImageKeywordNeedsReplace(llmRaw)) {
    if (isHanatourLlmImageKeywordGroundedInHaystack(llmRaw, haystack, candidates)) {
      try {
        const fin = finalizeScheduleImageKeyword(llmRaw)
        if (fin && normKey(fin) !== primaryKey) return fin
      } catch {
        /* fall through */
      }
    }
  }

  const pool =
    dayKind === 'movement' || dayKind === 'return_home'
      ? overseasCityCandidates(candidates)
      : [...landmarkCandidates(candidates), ...overseasCityCandidates(candidates)]

  for (const c of pool) {
    if (normKey(c) !== primaryKey) return c
  }

  return null
}

export function applyHanatourScheduleImageKeywordsToRows<
  T extends HanatourScheduleImageKeywordRow,
>(rows: T[], _opts?: HanatourScheduleImageKeywordOpts): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0)
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1

  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) {
      return {
        ...row,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: row.imageKeyword2 ?? null,
      }
    }

    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(day, maxDay, haystack)
    const primary = resolveHanatourPrimaryKeyword(row, dayKind, maxDay, sorted)
    const secondary = primary
      ? resolveHanatourSecondaryKeyword(row, primary, dayKind, maxDay, sorted)
      : null

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary,
    }
  })
}
