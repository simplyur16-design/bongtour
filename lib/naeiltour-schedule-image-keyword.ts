/**
 * 내일투어(naeiltour): 일차 imageKeyword / imageKeyword2 — Pexels 영문.
 * 일정요약 routeText a–g + h3 span 영문 랜드마크 SSOT. 일차 슬롯 규칙(출발·중간·귀국) 적용.
 * REGRESSION-FREEZE[naeiltour-schedule-image-keyword]: route a-g slot rules — manifest
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-naeiltour'
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'
import { splitRouteTextPlaceSegments, englishFromScheduleKoreanSegment } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { firstMatchingScheduleSpotEn, firstMatchingScheduleCityEn } from '@/lib/schedule-poi-regex-ssot'

export type NaeiltourScheduleImageKeywordRow = RegisterScheduleDay & {
  naeiltourEnglishRouteLandmarks?: string[] | null
}

const DOMESTIC_HUB_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주|ICN|GMP|PUS|TAE|CJJ|CJU)$/iu

/** 일정요약 routeText 세그먼트 고유 지명 — 영문 표기(추측 랜드마크 아님). */
const NAEILTOUR_ROUTE_CITY_EN: Readonly<Record<string, string>> = {
  인천: 'Incheon',
  프랑크푸르트: 'Frankfurt',
  마인츠: 'Mainz',
  코헴: 'Cochem',
  트리어: 'Trier',
  룩셈부르크: 'Luxembourg',
  브뤼셀: 'Brussels',
  암스테르담: 'Amsterdam',
  브뤼헤: 'Bruges',
  파리: 'Paris',
  로마: 'Rome',
  밀라노: 'Milan',
  피렌체: 'Florence',
  베니스: 'Venice',
  바르셀로나: 'Barcelona',
  마드리드: 'Madrid',
  런던: 'London',
  하이델베르크: 'Heidelberg',
  뤼데스하임: 'Rudesheim',
  마스메켈렌: 'Maasmechelen',
  홍콩: 'Hong Kong',
  마카오: 'Macau',
  도쿄: 'Tokyo',
  오사카: 'Osaka',
  후쿠오카: 'Fukuoka',
  삿포로: 'Sapporo',
  방콕: 'Bangkok',
  싱가포르: 'Singapore',
  다낭: 'Da Nang',
  하노이: 'Hanoi',
  호치민: 'Ho Chi Minh City',
}

function normKey(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function isAcceptableEnglishKeyword(raw: string): boolean {
  const t = String(raw ?? '').trim()
  if (!t || t.length < 3 || t.length > 80) return false
  if (/[\uAC00-\uD7AF]/.test(t)) return false
  if (isBlockedScheduleImageKeyword(t)) return false
  if (!/[a-zA-Z]/.test(t)) return false
  if (/\b(hotel|resort|breakfast|lunch|dinner)\b/i.test(t)) return false
  return true
}

function finalizeKw(raw: string): string {
  if (!isAcceptableEnglishKeyword(raw)) return ''
  try {
    return finalizeScheduleImageKeyword(raw.trim())
  } catch {
    return raw.trim()
  }
}

function romanizeNaeiltourRouteSegment(seg: string): string {
  const bare = String(seg ?? '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!bare) return ''
  const direct = NAEILTOUR_ROUTE_CITY_EN[bare]
  if (direct) return finalizeKw(direct)
  for (const [ko, en] of Object.entries(NAEILTOUR_ROUTE_CITY_EN)) {
    if (bare.includes(ko)) return finalizeKw(en)
  }
  return ''
}

function englishFromKoreanSegment(seg: string): string {
  const roman = romanizeNaeiltourRouteSegment(seg)
  if (roman) return roman
  const fromSchedule = englishFromScheduleKoreanSegment(seg)
  if (fromSchedule) return finalizeKw(fromSchedule)
  const spot = firstMatchingScheduleSpotEn(seg)
  if (spot) return finalizeKw(spot)
  const city = firstMatchingScheduleCityEn(seg)
  if (city) return finalizeKw(city)
  return ''
}

function collectEnglishCandidates(row: NaeiltourScheduleImageKeywordRow): string[] {
  const fromParsed = (row.naeiltourEnglishRouteLandmarks ?? [])
    .map((x) => finalizeKw(String(x ?? '').trim()))
    .filter(Boolean)
  if (fromParsed.length) return fromParsed.slice(0, 7)

  const out: string[] = []
  for (const seg of splitRouteTextPlaceSegments(row.routeText)) {
    if (DOMESTIC_HUB_RE.test(seg.trim())) continue
    const en = englishFromKoreanSegment(seg)
    if (en) out.push(en)
  }
  return out.slice(0, 7)
}

function firstUnused(candidates: readonly string[], used: ReadonlySet<string>): string {
  for (const c of candidates) {
    const k = normKey(c)
    if (k && !used.has(k)) return c
  }
  return ''
}

function secondUnused(candidates: readonly string[], used: ReadonlySet<string>, primary: string): string {
  const pk = normKey(primary)
  for (const c of candidates) {
    const k = normKey(c)
    if (k && k !== pk && !used.has(k)) return c
  }
  return ''
}

function departureFallback(row: NaeiltourScheduleImageKeywordRow, productDestination?: string | null): string {
  for (const seg of splitRouteTextPlaceSegments(row.routeText)) {
    if (DOMESTIC_HUB_RE.test(seg.trim())) continue
    const en = englishFromKoreanSegment(seg)
    if (en) return en
  }
  const dest = String(productDestination ?? '').trim()
  if (dest) {
    const en = englishFromKoreanSegment(dest)
    if (en) return en
  }
  return ''
}

export function applyNaeiltourScheduleImageKeywordsToRows<T extends NaeiltourScheduleImageKeywordRow>(
  rows: T[],
  opts?: { productDestination?: string | null; englishLandmarksByDay?: ReadonlyMap<number, string[]> },
): T[] {
  if (!rows.length) return rows
  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = sorted.reduce((m, r) => Math.max(m, Number(r.day) || 0), 0)
  const tripUsed = new Set<string>()
  const dayAlloc = new Map<number, { primary: string; secondary: string }>()

  return sorted.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, sorted.length)
    const englishFromMap = opts?.englishLandmarksByDay?.get(day)
    const enriched: NaeiltourScheduleImageKeywordRow = {
      ...row,
      naeiltourEnglishRouteLandmarks:
        englishFromMap ?? row.naeiltourEnglishRouteLandmarks ?? null,
    }
    const candidates = collectEnglishCandidates(enriched)

    let primary = ''
    let secondary = ''

    if (slot === 'departure') {
      primary = firstUnused(candidates, tripUsed)
      if (!primary) primary = departureFallback(enriched, opts?.productDestination)
    } else if (slot === 'middle') {
      primary = firstUnused(candidates, tripUsed)
      if (primary) tripUsed.add(normKey(primary))
      secondary = secondUnused(candidates, tripUsed, primary)
    } else {
      const prev = sorted.find((r) => Number(r.day) === day - 1)
      const prevEn =
        opts?.englishLandmarksByDay?.get(day - 1) ??
        prev?.naeiltourEnglishRouteLandmarks ??
        null
      const prevCandidates = prevEn?.length
        ? prevEn.map((x) => finalizeKw(x)).filter(Boolean)
        : prev
          ? collectEnglishCandidates(prev)
          : []
      const prevUsed = new Set<string>()
      const prevAlloc = dayAlloc.get(day - 1)
      if (prevAlloc?.primary) prevUsed.add(normKey(prevAlloc.primary))
      if (prevAlloc?.secondary) prevUsed.add(normKey(prevAlloc.secondary))
      primary =
        prevCandidates.find((c) => !prevUsed.has(normKey(c)) && !tripUsed.has(normKey(c))) ?? ''
    }

    if (primary) tripUsed.add(normKey(primary))
    if (secondary) tripUsed.add(normKey(secondary))
    dayAlloc.set(day, { primary, secondary })

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: slot === 'middle' && secondary ? secondary : null,
    }
  })
}
