/**
 * Fit 예시 일정 → Product.schedule[].imageKeyword (에어텔 등록 후 동기화 전용).
 */
import {
  extractEnglishPoiFromLabel,
  mapDestination,
  mapKoreanPoiSegment,
} from '@/lib/pexels-keyword'
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

const KEYWORD_CATEGORY_ORDER = ['attraction', 'shopping', 'meal'] as const

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

function keywordFromActivity(act: FitItineraryActivityForKeyword): string | null {
  for (const field of [act.location, act.title, act.description]) {
    const phrase = extractEnglishPlacePhrase(field)
    if (!phrase) continue
    const kw = tryPersistFitImageKeyword(phrase)
    if (kw) return kw
  }
  for (const field of [act.location, act.title, act.description]) {
    const kw = englishFromKoreanPlaceText(field)
    if (kw) return kw
  }
  return null
}

export type FitDayImageKeywordFallbackContext = {
  cityNameKo: string
  cityKey: string
  productTitle: string
  primaryDestination?: string | null
  destination?: string | null
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

/** attraction 우선 전 — 카테고리·transport 스킵 없이 활동 전체 스캔 */
function keywordFromDayActivitiesAnyOrder(day: FitItineraryDayForKeyword): string | null {
  const activities = [...(day.activities ?? [])].sort((a, b) => a.order - b.order)
  for (const act of activities) {
    const kw = keywordFromActivity(act)
    if (kw) return kw
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

/** 일차 대표 Pexels 키워드 — attraction → shopping → meal, 없으면 일차 메타·상품 도시 폴백 */
export function pickFitDayImageKeyword(
  day: FitItineraryDayForKeyword,
  fallbackCtx: FitDayImageKeywordFallbackContext,
): string {
  const activities = [...(day.activities ?? [])].sort((a, b) => a.order - b.order)
  for (const cat of KEYWORD_CATEGORY_ORDER) {
    for (const act of activities) {
      if (act.category !== cat) continue
      const kw = keywordFromActivity(act)
      if (kw) return kw
    }
  }
  for (const act of activities) {
    if (act.category === 'transport' || act.category === 'hotel') continue
    const kw = keywordFromActivity(act)
    if (kw) return kw
  }
  const fromAnyAct = keywordFromDayActivitiesAnyOrder(day)
  if (fromAnyAct) return fromAnyAct
  return buildFitDayImageKeywordFallback(fallbackCtx, day)
}
