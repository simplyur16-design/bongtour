/**
 * 자유여행 SSOT — 제미나이 예시 일정에서 일차 동선(routeText)과 imageKeyword를 뽑는다.
 * REGRESSION-FREEZE[fit-itinerary-gemini-route-keyword]: attraction 랜드마크만 키워드, 식사·쇼핑 상호 금지 — manifest
 */
import {
  extractEnglishPoiFromLabel,
  mapDestination,
  mapKoreanPoiSegment,
} from '@/lib/pexels-keyword'
import {
  isBareCityOrCountryKeyword,
  isNonLandmarkFoodOrDiningImageKeyword,
  isNonLandmarkSpaShoppingLoungeImageKeyword,
} from '@/lib/pexels-place-name-keyword'
import { isBrokenRegisterLandmarkKeyword } from '@/lib/register-pre-photo-guards'
import { persistScheduleImageKeyword } from '@/lib/schedule-image-keyword-persist'
import { resolveTravelSubjectEnForMedia } from '@/lib/pexels-keyword'

export type FitItineraryActivityForKeyword = {
  order: number
  category: string
  title: string
  description: string
  location: string
}

export type FitItineraryDayForKeyword = {
  dayNumber: number
  title: string
  summary: string
  dayCityKey?: string
  activities: FitItineraryActivityForKeyword[]
}

/** 키워드 1순위 — 관광. hotel은 FIT 숙소일 허용. 식사·쇼핑 상호는 키워드 후보에서 걸러낸다. */
const KEYWORD_CATEGORY_ORDER = ['attraction', 'hotel'] as const
const ROUTE_PLACE_CATEGORIES = new Set(['transport', 'hotel', 'meal', 'attraction', 'shopping'])
const GENERIC_FIT_ROUTE_LABEL_RE = /^(택시|버스|지하철|MRT|도보|이동|픽업|체크인|체크아웃)$/iu

const CJK_IN_PAREN_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/

function extractEnglishPlacePhrase(text: string): string | null {
  const t = String(text ?? '').trim()
  if (!t) return null

  const parenMatches = [...t.matchAll(/\(\s*([^)]+)\s*\)/g)]
  for (let i = parenMatches.length - 1; i >= 0; i--) {
    const inner = parenMatches[i]![1]!.trim()
    if (inner.length < 3 || !/[A-Za-z]{3,}/.test(inner)) continue
    if (CJK_IN_PAREN_RE.test(inner)) continue
    return inner
  }

  if (/^[A-Za-z0-9][A-Za-z0-9\s,.'\-–—]{2,}$/.test(t) && /[A-Za-z]{3,}/.test(t)) {
    return t
  }
  return null
}

function tryPersistFitImageKeyword(raw: string): string | null {
  try {
    const v = persistScheduleImageKeyword(raw)
    return v || null
  } catch {
    return null
  }
}

/** 괄호 영문 없을 때 — 한글 POI·라벨에서 영문 고유명 (패키지 일정 규칙과 동일 계열) */
function englishFromKoreanPlaceText(text: string): string | null {
  const t = String(text ?? '').trim()
  if (!t) return null

  const fromLabel = extractEnglishPoiFromLabel(t)
  if (fromLabel) {
    const kw = tryPersistFitImageKeyword(fromLabel)
    if (kw) return kw
  }

  const fromPoi = mapKoreanPoiSegment(t)
  if (fromPoi) {
    const kw = tryPersistFitImageKeyword(fromPoi)
    if (kw) return kw
  }

  const fromDest = mapDestination(t)
  if (fromDest && fromDest !== t) {
    const kw = tryPersistFitImageKeyword(fromDest)
    if (kw) return kw
  }

  return null
}

function acceptFitImageKeyword(kw: string, opts: { fromAttraction: boolean }): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return false
  if (isNonLandmarkFoodOrDiningImageKeyword(t)) return false
  if (isNonLandmarkSpaShoppingLoungeImageKeyword(t)) return false
  if (opts.fromAttraction) return true
  return !isBrokenRegisterLandmarkKeyword(t, { allowHotelLodging: true })
}

function keywordFromActivity(
  act: FitItineraryActivityForKeyword,
  opts: { fromAttraction: boolean },
): string | null {
  for (const field of [act.location, act.title, act.description]) {
    const phrase = extractEnglishPlacePhrase(field)
    if (!phrase) continue
    const kw = tryPersistFitImageKeyword(phrase)
    if (kw && acceptFitImageKeyword(kw, opts)) return kw
  }
  for (const field of [act.location, act.title, act.description]) {
    const kw = englishFromKoreanPlaceText(field)
    if (kw && acceptFitImageKeyword(kw, opts)) return kw
  }
  return null
}

/** 예시 일정 그날 activities → 동선. 한글 지명을 ` - ` 로 잇는다. */
export function buildFitDayRouteText(day: FitItineraryDayForKeyword): string {
  const activities = [...(day.activities ?? [])].sort((a, b) => a.order - b.order)
  const segs: string[] = []
  const seen = new Set<string>()
  for (const act of activities) {
    if (!ROUTE_PLACE_CATEGORIES.has(act.category)) continue
    const loc = String(act.location ?? '').trim()
    const title = String(act.title ?? '').trim()
    const raw = loc || title
    if (!raw) continue
    const token = raw.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
    if (token.length < 2) continue
    if (GENERIC_FIT_ROUTE_LABEL_RE.test(token)) continue
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    segs.push(token)
  }
  return segs.join(' - ')
}

export type FitDayImageKeywordFallbackContext = {
  cityNameKo: string
  cityKey: string
  productTitle: string
  primaryDestination?: string | null
  destination?: string | null
}

function isPlaceholderFitDayLabel(text: string): boolean {
  return /^day\s*\d+$/i.test(String(text ?? '').trim())
}

function keywordFromDayMeta(day: Pick<FitItineraryDayForKeyword, 'title' | 'summary' | 'dayCityKey'>): string | null {
  const cityKey = String(day.dayCityKey ?? '').trim()
  if (cityKey) {
    const fromKey = mapDestination(cityKey) || mapDestination(cityKey.replace(/_/g, ' '))
    if (fromKey) {
      const kw = tryPersistFitImageKeyword(fromKey)
      if (kw) return kw
    }
  }
  for (const text of [day.title, day.summary]) {
    if (isPlaceholderFitDayLabel(text)) continue
    const kw = englishFromKoreanPlaceText(text)
    if (kw) return kw
  }
  const blob = [day.title, day.summary].filter((t) => String(t ?? '').trim()).join(' ')
  if (blob) {
    const fromPoi = mapKoreanPoiSegment(blob)
    if (fromPoi) {
      const kw = tryPersistFitImageKeyword(fromPoi)
      if (kw) return kw
    }
  }
  return null
}

export function buildFitDayImageKeywordFallback(
  ctx: FitDayImageKeywordFallbackContext,
  day?: Pick<FitItineraryDayForKeyword, 'title' | 'summary' | 'dayCityKey'>,
): string {
  if (day) {
    const fromDay = keywordFromDayMeta(day)
    if (fromDay) return fromDay
  }

  const subject = resolveTravelSubjectEnForMedia({
    destination: ctx.primaryDestination ?? ctx.destination ?? ctx.cityNameKo,
    primaryRegion: ctx.cityKey,
    title: ctx.productTitle,
    themeTags: null,
  })
  if (subject && subject !== 'travel') {
    const kw = tryPersistFitImageKeyword(subject)
    if (kw) return kw
  }
  const city = ctx.cityNameKo.trim()
  if (city) {
    const kw = tryPersistFitImageKeyword(city)
    if (kw) return kw
  }
  return 'travel'
}

function isWeakFitDayImageKeyword(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t || t.toLowerCase() === 'travel') return true
  if (/^nha$/i.test(t)) return true
  if (/^nha\s*trang$/i.test(t)) return true
  if (/^day\s*\d+$/i.test(t)) return true
  return isBareCityOrCountryKeyword(t)
}

/** 예시 일정 일차별 후보 — attraction → hotel → 일차 메타 → (랜드마크인) meal·shopping → 도시 */
export function collectFitDayImageKeywordCandidates(
  day: FitItineraryDayForKeyword,
  fallbackCtx: FitDayImageKeywordFallbackContext,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (kw: string | null | undefined) => {
    const k = String(kw ?? '').trim()
    if (!k) return
    const lower = k.toLowerCase()
    if (seen.has(lower)) return
    seen.add(lower)
    out.push(k)
  }

  const activities = [...(day.activities ?? [])].sort((a, b) => a.order - b.order)
  for (const cat of KEYWORD_CATEGORY_ORDER) {
    for (const act of activities) {
      if (act.category !== cat) continue
      push(keywordFromActivity(act, { fromAttraction: cat === 'attraction' }))
    }
  }
  for (const act of activities) {
    if (act.category !== 'meal' && act.category !== 'shopping') continue
    push(keywordFromActivity(act, { fromAttraction: false }))
  }
  push(keywordFromDayMeta(day))
  push(buildFitDayImageKeywordFallback(fallbackCtx, day))
  return out
}

/** 여러 일차에 걸쳐 중복 키워드 회피 — 예시 일정 SSOT 추출용 */
export function pickFitDayImageKeywordDistinct(
  day: FitItineraryDayForKeyword,
  fallbackCtx: FitDayImageKeywordFallbackContext,
  usedLower: Set<string>,
): string {
  const candidates = collectFitDayImageKeywordCandidates(day, fallbackCtx)
  for (const kw of candidates) {
    if (!isWeakFitDayImageKeyword(kw) && !usedLower.has(kw.toLowerCase())) return kw
  }
  for (const kw of candidates) {
    if (!usedLower.has(kw.toLowerCase())) return kw
  }
  return candidates[0] ?? buildFitDayImageKeywordFallback(fallbackCtx, day)
}

export function areFitDayImageKeywordsUniform(dayKeywords: Record<number, string>): boolean {
  const values = Object.values(dayKeywords)
    .map((v) => String(v ?? '').trim().toLowerCase())
    .filter((v) => v.length > 0)
  if (values.length < 2) return false
  return new Set(values).size === 1
}

/** 일차 대표 Pexels 키워드 — attraction 랜드마크, 없으면 일차 메타·상품 도시 폴백 */
export function pickFitDayImageKeyword(
  day: FitItineraryDayForKeyword,
  fallbackCtx: FitDayImageKeywordFallbackContext,
): string {
  return pickFitDayImageKeywordDistinct(day, fallbackCtx, new Set())
}

/**
 * 자유여행 SSOT — 예시 일정 전체에서 대표 랜드마크 1개만 뽑는다(일차별 키워드 금지).
 * 도착·출국일보다 중간 관광일(2~N-1일차) attraction을 우선한다.
 */
export function pickSingleAirtelFitImageKeywordFromDays(
  fitDays: FitItineraryDayForKeyword[],
  fallbackCtx: FitDayImageKeywordFallbackContext,
): string {
  const sorted = [...fitDays].sort((a, b) => a.dayNumber - b.dayNumber)
  if (!sorted.length) return buildFitDayImageKeywordFallback(fallbackCtx)

  const maxDayNumber = sorted.reduce((max, d) => Math.max(max, d.dayNumber), 0)
  const middleDays = sorted.filter((d) => d.dayNumber > 1 && d.dayNumber < maxDayNumber)
  const scanOrder = [
    ...middleDays,
    ...sorted.filter((d) => d.dayNumber === 1),
    ...sorted.filter((d) => d.dayNumber === maxDayNumber),
  ]

  const usedLower = new Set<string>()
  for (const day of scanOrder) {
    const kw = pickFitDayImageKeywordDistinct(day, fallbackCtx, usedLower)
    if (!kw) continue
    usedLower.add(kw.toLowerCase())
    if (!isWeakFitDayImageKeyword(kw)) return kw
  }

  for (const day of sorted) {
    const kw = pickFitDayImageKeyword(day, fallbackCtx)
    if (kw && !isWeakFitDayImageKeyword(kw)) return kw
  }

  return buildFitDayImageKeywordFallback(fallbackCtx, sorted[Math.min(1, sorted.length - 1)])
}
